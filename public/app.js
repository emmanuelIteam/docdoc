/* Selection + inline rename for the outliner.
   The outline is re-rendered server-side by htmx, so we only add
   client-side behavior that is not naturally server-rendered. */

'use strict';

// The active domain is rendered into <body data-domain-slug="..."> on each page.
// Client-side operations (rename, toggle, move, reload) must target the active
// domain's scoped routes.
const activeSlug = document.body.dataset.domainSlug || '';
function domainPath(route) {
  return '/domaine/' + activeSlug + '/' + String(route).replace(/^\//, '');
}

function reloadOutline() {
  if (window.htmx) {
    htmx.ajax('GET', domainPath('/outline-fragment'), { target: '#outline', swap: 'outerHTML' });
  } else {
    location.reload();
  }
}

/* -------------------------------------------------------------------- */
/* Flat outline helpers.                                                 */
/* The outline is rendered as a flat sequence of .line elements, each     */
/* carrying its hierarchy depth (data-depth) and its parent's id          */
/* (data-parent): a line is displayed where the domain's display order    */
/* puts it, not where DOM nesting would. A line inserted below another    */
/* one is displayed *before* that line's sub-lines, so a line's subtree   */
/* is NOT the lines immediately following it: it is the following lines   */
/* of its own region (depth >= its own) whose parent chain contains it.   */
/* -------------------------------------------------------------------- */

function depthOf(line) {
  const depth = parseInt(line.dataset.depth, 10);
  return Number.isFinite(depth) ? depth : 0;
}

// Every line of the outline, in display order.
function outlineRows() {
  const outline = document.querySelector('#outline');
  return outline ? Array.from(outline.querySelectorAll('.line')) : [];
}

// The displayed sub-lines of a line: the following lines of its region whose
// parent chain (data-parent) contains it.
function subtreeRows(line) {
  const rows = [];
  if (!line) return rows;
  const parentOf = new Map();
  outlineRows().forEach((row) => parentOf.set(row.dataset.id, row.dataset.parent || ''));
  const isDescendantOfLine = (id) => {
    let current = parentOf.get(id) || '';
    while (current) {
      if (current === line.dataset.id) return true;
      current = parentOf.get(current) || '';
    }
    return false;
  };
  const depth = depthOf(line);
  for (let el = line.nextElementSibling; el; el = el.nextElementSibling) {
    if (!el.classList || !el.classList.contains('line')) continue;
    // Leaving the line's region: nothing deeper can belong to it any more.
    if (depthOf(el) < depth) break;
    if (isDescendantOfLine(el.dataset.id)) rows.push(el);
  }
  return rows;
}

// Scope of a status action, resolved from the live selection: the status
// cascades to the whole displayed subtree when one of the head line's sub-lines
// is selected, and applies to the head line alone otherwise. Called from the
// server-rendered `hx-vals` of the status buttons.
window.outlineSubtreeHasSelected = function outlineSubtreeHasSelected(el) {
  const line = el && el.closest ? el.closest('.line') : null;
  if (!line) return false;
  return subtreeRows(line).some((row) => row.classList.contains('selected'));
};

function caretOffsetAtPoint(span, x, y) {
  let position = null;
  if (typeof document.caretPositionFromPoint === 'function') {
    position = document.caretPositionFromPoint(x, y);
  } else if (typeof document.caretRangeFromPoint === 'function') {
    const range = document.caretRangeFromPoint(x, y);
    if (range) position = { offsetNode: range.startContainer, offset: range.startOffset };
  }
  if (!position || !position.offsetNode) return null;
  const node = position.offsetNode;
  if (node === span) return position.offset; // offset indexes span's child nodes
  if (!span.contains(node)) return null;
  let offset = position.offset;
  let prev = node.previousSibling;
  while (prev) {
    offset += (prev.textContent || '').length;
    prev = prev.previousSibling;
  }
  return offset;
}

function startRename(span, clientX, clientY, forceEnd, selectAll) {
  const id = span.dataset.id;
  const original = span.textContent;
  let done = false;

  // Determine where in the title the user clicked so the edit field opens with
  // the caret at that exact position (no "select-all"). When the rename is
  // started from the line's free space (forceEnd), always open with the caret
  // after the last character. When a freshly created line is focused
  // (selectAll), the placeholder text is selected so typing replaces it.
  let caret = original.length;
  if (!forceEnd) {
    const hit = caretOffsetAtPoint(span, clientX, clientY);
    if (hit !== null) caret = Math.max(0, Math.min(hit, original.length));
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'title-input';
  input.value = original;
  span.replaceWith(input);
  input.focus();

  // Apply the caret on the next frame so the browser's own focus/caret handling
  // cannot move it to the end or reset it after we set it.
  requestAnimationFrame(() => {
    if (done || !input.isConnected) return;
    if (selectAll) input.setSelectionRange(0, original.length);
    else input.setSelectionRange(caret, caret);
  });

  // Keep the field as wide as the text (plus slack for the caret), so the
  // edit mode stays discreet and matches the current title width.
  const sizeInput = () => {
    input.style.width = Math.max(2, input.value.length + 1) + 'ch';
  };
  sizeInput();
  input.addEventListener('input', sizeInput);

  const finish = async (save, next) => {
    if (done) return;
    done = true;

    const value = save ? input.value.trim() : '';
    const replacement = document.createElement('span');
    replacement.className = span.className;
    replacement.dataset.id = id;
    replacement.textContent = value || original;

    input.replaceWith(replacement);

    // Save a changed title (blur or Enter).
    let titleChanged = false;
    if (save && value && value !== original) {
      titleChanged = true;
      try {
        await fetch(domainPath('/api/nodes/' + id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: value }),
        });
      } catch (err) {
        console.error('Erreur renommage:', err);
        return;
      }
    }

    // Enter: create a new line at the same level, right after this one, and
    // focus it so the user can keep typing.
    if (next) {
      try {
        const res = await fetch(domainPath('/api/nodes/' + id + '/next'), { method: 'POST' });
        if (!res.ok) throw new Error('Création de ligne refusée (' + res.status + ')');
        const newId = res.headers.get('X-New-Node-Id');
        const html = await res.text();
        const outlineEl = document.querySelector('#outline');
        if (outlineEl) {
          outlineEl.outerHTML = html;
          if (newId) {
            const newLine = document.querySelector('.line[data-id="' + newId + '"]');
            const newTitle = newLine && newLine.querySelector('.title');
            if (newTitle) startRename(newTitle, 0, 0, true, true);
          }
        } else {
          location.reload();
        }
      } catch (err) {
        console.error('Erreur création ligne:', err);
        reloadOutline();
      }
      return;
    }

    // No sibling (blur/save): refresh only when the title changed.
    if (titleChanged) reloadOutline();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true, true);
    } else if (e.key === 'Escape') {
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
}

document.addEventListener('click', (e) => {
  const bullet = e.target.closest('.bullet');
  if (bullet) {
    const line = bullet.closest('.line');
    if (line) {
      // Single active selection, toggling between two states on the head line:
      //  1. first click selects the head line and its whole subtree;
      //  2. a second click on the head line narrows the selection to the head
      //     line only (sub-lines deselect), and the status actions then apply
      //     to the head line alone;
      //  3. a third click re-selects the head line and its whole subtree,
      //     closing the cycle (group ⇄ head only).
      //
      // The status scope is derived at request time from these classes (see the
      // server's status buttons), so no scope state is kept here.
      const subRows = subtreeRows(line);
      const targets = [line, ...subRows];
      const isHead = line.classList.contains('selected-head');
      // True while the head and one or more of its sub-lines are selected.
      const hadSubtreeSelected = subRows.some((row) => row.classList.contains('selected'));

      document.querySelectorAll('.line.selected, .line.selected-head').forEach((l) => {
        l.classList.remove('selected');
        l.classList.remove('selected-head');
      });

      if (!isHead) {
        // Stage 1: select the whole subtree under this line.
        targets.forEach((l) => l.classList.add('selected'));
        line.classList.add('selected-head');
      } else if (hadSubtreeSelected) {
        // Stage 2: keep only the head line selected.
        line.classList.add('selected');
        line.classList.add('selected-head');
      } else {
        // Stage 3: the head line is selected with no sub-line selected, so
        // re-select the whole subtree (back to the group state).
        targets.forEach((l) => l.classList.add('selected'));
        line.classList.add('selected-head');
      }
    }
    return;
  }

  const title = e.target.closest('.title');
  if (title && !title.dataset.editing) {
    startRename(title, e.clientX, e.clientY);
    return;
  }

  // Click on the line's own free space (after the title text, or at its very
  // end): enter edit mode with the caret at the end of the last character.
  // The bullet and title are handled above; the context menu and any input are
  // left alone.
  const line = e.target.closest('.line');
  if (
    line &&
    line.dataset.id &&
    !e.target.closest('.menu') &&
    !e.target.closest('.menu-item') &&
    !e.target.closest('input')
  ) {
    const titleEl = line.querySelector('.title');
    if (titleEl && !titleEl.dataset.editing) {
      startRename(titleEl, e.clientX, e.clientY, true);
    }
  }
});

// Close the context menu (and clear the selection) when the pointer leaves the
// selected head line. The menu is a child of the line and is anchored above it,
// so moving between the line and its menu (or across the menu's hover-bridge)
// is NOT "leaving the line" — the selection only clears once the pointer truly
// moves off the head line (e.g. onto a sub-line, a neighbour, or off the list).
document.addEventListener('mouseout', (e) => {
  const head = e.target.closest('.line.selected-head');
  if (!head) return;
  const to = e.relatedTarget;
  // Still inside the line (a sub-element, the menu, or its hover-bridge).
  if (to && head.contains(to)) return;
  document.querySelectorAll('.line.selected, .line.selected-head').forEach((l) => {
    l.classList.remove('selected');
    l.classList.remove('selected-head');
  });
});

// Double-click the selection button (bullet) to collapse/expand a line.
// The title, rename input, and context menu are ignored so renaming and the
// menu are unaffected.
document.addEventListener('dblclick', (e) => {
  if (e.target.closest('.title')) return;
  if (e.target.closest('.title-input')) return;
  if (e.target.closest('input')) return;
  if (e.target.closest('.menu')) return;

  // Only the selection button acts as the collapse/expand trigger.
  const bullet = e.target.closest('.bullet');
  if (!bullet) return;

  const line = bullet.closest('.line');
  if (!line || !line.dataset.id) return;

  if (window.htmx) {
    htmx.ajax('POST', domainPath('/api/nodes/' + line.dataset.id + '/toggle'), {
      target: '#outline',
      swap: 'outerHTML',
    });
  }
});

/* -------------------------------------------------------------------- */
/* Drag-and-drop to move a line (with its whole subtree).                */
/* Drag starts only on the selection button (.bullet). The outline is     */
/* re-rendered by htmx, so the handlers are delegated on document.        */
/* -------------------------------------------------------------------- */

// State held for the duration of a drag.
let dragSourceId = null;   // the dragged line's data-id
let dragSourceLine = null; // the dragged .line element
let dragGhost = null;      // offscreen clone used as the drag image

function clearDropIndicators() {
  document
    .querySelectorAll(
      '.line.drop-target, .line.drop-before, .line.drop-after, .line.drop-inside, .line.drop-invalid'
    )
    .forEach((el) =>
      el.classList.remove('drop-target', 'drop-before', 'drop-after', 'drop-inside', 'drop-invalid')
    );
  const root = document.querySelector('#outline.drop-root');
  if (root) root.classList.remove('drop-root');
}

function resolveDropTarget(el) {
  const line = el.closest('.line');
  if (line) return { kind: 'line', line };
  const outline = el.closest('#outline');
  if (outline) return { kind: 'root', outline };
  return null;
}

// Top third -> insert as previous sibling, bottom third -> next sibling,
// middle -> become the last child of the target line.
function positionAt(e, line) {
  const rect = line.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'inside';
}

// A drop is invalid when the target is the dragged line itself or one of its
// displayed descendants (which would create a cycle).
function isInvalidDrop(target) {
  if (target.kind === 'root') return false;
  if (target.line.dataset.id === dragSourceId) return true;
  return subtreeRows(dragSourceLine).includes(target.line);
}

// The drag ghost shows the dragged line together with its displayed subtree.
// setDragImage needs an element rendered in the document, so the clone is
// parked offscreen (see `.drag-ghost` in style.css) and removed on dragend.
function buildDragGhost(line) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  [line, ...subtreeRows(line)].forEach((row) => {
    const clone = row.cloneNode(true);
    clone.classList.remove('selected', 'selected-head', 'dragging');
    ghost.appendChild(clone);
  });
  document.body.appendChild(ghost);
  return ghost;
}

function clearDragGhost() {
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
}

document.addEventListener('dragstart', (e) => {
  const bullet = e.target.closest('.bullet');
  if (!bullet) return;
  const line = bullet.closest('.line');
  if (!line || !line.dataset.id) return;

  dragSourceId = line.dataset.id;
  dragSourceLine = line;
  line.classList.add('dragging');

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSourceId);
    // Use the whole line/subtree as the drag ghost, not just the tiny bullet.
    dragGhost = buildDragGhost(line);
    e.dataTransfer.setDragImage(dragGhost, 0, 0);
  }
});

document.addEventListener('dragover', (e) => {
  if (!dragSourceId) return;
  const target = resolveDropTarget(e.target);
  if (!target) return;

  clearDropIndicators();

  const valid = !isInvalidDrop(target);
  if (e.dataTransfer) e.dataTransfer.dropEffect = valid ? 'move' : 'none';
  if (!valid) {
    // Do not preventDefault: the browser shows a forbidden drop.
    if (target.kind === 'line') target.line.classList.add('drop-invalid');
    return;
  }

  e.preventDefault(); // allow the drop

  if (target.kind === 'line') {
    const pos = positionAt(e, target.line);
    target.line.classList.add('drop-target');
    target.line.classList.add('drop-' + pos);
  } else {
    target.outline.classList.add('drop-root');
  }
});

document.addEventListener('drop', (e) => {
  if (!dragSourceId) return;
  const target = resolveDropTarget(e.target);
  if (!target) return;
  if (isInvalidDrop(target)) return;

  e.preventDefault();
  clearDropIndicators();

  const targetId = target.kind === 'line' ? target.line.dataset.id : null;
  const position = target.kind === 'line' ? positionAt(e, target.line) : 'inside';

  fetch(domainPath('/api/nodes/' + dragSourceId + '/move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId, position }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('Déplacement refusé (' + res.status + ')');
      reloadOutline();
    })
    .catch((err) => console.error('Erreur déplacement:', err));
});

document.addEventListener('dragend', () => {
  if (dragSourceLine) dragSourceLine.classList.remove('dragging');
  dragSourceLine = null;
  dragSourceId = null;
  clearDragGhost();
  clearDropIndicators();
});

/* -------------------------------------------------------------------- */
/* Sidebar: toggle collapse + create-domain form.                       */
/* The collapsed state is persisted in localStorage so it survives       */
/* navigation (each page is a full load and re-applies the state).       */
/* -------------------------------------------------------------------- */

function applySidebarState() {
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
  }
}

const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '');
  });
}

const newDomainBtn = document.getElementById('new-domain-btn');
const newDomainForm = document.getElementById('new-domain-form');
if (newDomainBtn && newDomainForm) {
  newDomainBtn.addEventListener('click', () => {
    const show = newDomainForm.hidden;
    newDomainForm.hidden = !show;
    newDomainBtn.textContent = show ? 'Fermer' : '+ Nouveau domaine';
    if (show) {
      const input = newDomainForm.querySelector('input');
      if (input) input.focus();
    }
  });
}

/* -------------------------------------------------------------------- */
/* Deep-link a line: copy its link and keep a reveal target active.      */
/* -------------------------------------------------------------------- */

// The reveal target present in the URL (?reveal=<id>), if any. While set, every
// outbound htmx request on the active domain re-sends it so re-rendered
// outlines keep the target's ancestors expanded.
const revealId = new URLSearchParams(location.search).get('reveal');

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Non-secure context fallback (plain http): a temporary textarea + execCommand.
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('copy refused'));
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// Copy a deep link to the clicked line. The menu is a child of the line, so the
// pointer is still inside the selected line while the button is clicked and the
// menu stays open. The copy-link button is intentionally NOT an htmx action.
document.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('.menu-item.copy-link');
  if (!copyBtn) return;
  const line = copyBtn.closest('.line');
  if (!line || !line.dataset.id) return;
  const id = line.dataset.id;
  const link = location.origin + location.pathname + '?reveal=' + id + '#node-' + id;
  copyToClipboard(link)
    .then(() => toast('Lien copié'))
    .catch(() => toast('Copie impossible'));
});

// While a reveal target is present in the URL, re-send it on every outbound
// htmx request for the active domain, so re-rendered outlines keep the target's
// ancestors expanded. Navigating to another domain (a full page load) drops it.
if (window.htmx && revealId) {
  document.body.addEventListener('htmx:configRequest', (e) => {
    const path = e.detail.path || '';
    if (path.indexOf('/domaine/' + activeSlug + '/') !== 0) return;
    e.detail.parameters = e.detail.parameters || {};
    e.detail.parameters.reveal = revealId;
  });
}

/* -------------------------------------------------------------------- */
/* Themes: toggle the create-theme form and the label picker.            */
/* -------------------------------------------------------------------- */

const newThemeBtn = document.getElementById('new-theme-btn');
const newThemeForm = document.getElementById('new-theme-form');
if (newThemeBtn && newThemeForm) {
  newThemeBtn.addEventListener('click', () => {
    const show = newThemeForm.hidden;
    newThemeForm.hidden = !show;
    newThemeBtn.textContent = show ? 'Fermer' : '+ Nouveau thème';
    if (show) {
      const input = newThemeForm.querySelector('input[name="name"]');
      if (input) input.focus();
    }
  });
}

const labelAddBtn = document.getElementById('label-add-btn');
const labelAttachForm = document.getElementById('label-attach-form');
if (labelAddBtn && labelAttachForm) {
  labelAddBtn.addEventListener('click', () => {
    labelAttachForm.hidden = !labelAttachForm.hidden;
    const select = labelAttachForm.querySelector('select');
    if (select && !labelAttachForm.hidden) select.focus();
  });
}

applySidebarState();

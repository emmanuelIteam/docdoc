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

// A refresh requested while a title is being edited is deferred: replacing
// `#outline` would detach the field the user is typing in (and close the
// keyboard). It is applied as soon as the last field closes. Declared before
// the two helpers that read it so their top-level definitions see it.
let outlineRefreshPending = false;

// Every `startRename` bumps this counter. A save or a structural response
// captures it, so a reply that lands after another field was opened can tell it
// is stale: replacing the outline then would destroy the newer field.
let editGeneration = 0;

function reloadOutline() {
  if (document.querySelector('.title-input')) {
    outlineRefreshPending = true;
    return;
  }
  // The refresh is starting: no deferred request is left to apply, even when the
  // swap is performed by htmx below (and therefore not by `swapOutlineHtml`).
  outlineRefreshPending = false;
  if (window.htmx) {
    htmx.ajax('GET', domainPath('/outline-fragment'), { target: '#outline', swap: 'outerHTML' });
  } else {
    location.reload();
  }
}

// Apply the deferred refresh once no edit field owns the screen.
function flushOutlineRefresh() {
  if (!outlineRefreshPending || document.querySelector('.title-input')) return;
  outlineRefreshPending = false;
  reloadOutline();
}

// Replace the outline with a server-rendered fragment. Assigning `outerHTML`
// inserts markup htmx knows nothing about: it does not watch the DOM, so
// without an explicit `htmx.process(...)` none of the new outline's `hx-*`
// attributes are bound and the whole context menu (statuses, indent/outdent,
// add a task, delete) is inert. Returns the fresh outline, or null when the
// page had no outline and was reloaded instead.
function swapOutlineHtml(html) {
  const outlineEl = document.querySelector('#outline');
  if (!outlineEl) {
    location.reload();
    return null;
  }
  outlineEl.outerHTML = html;
  const fresh = document.querySelector('#outline');
  if (window.htmx && fresh) htmx.process(fresh);
  // The fragment just rendered the server's current outline: a refresh that was
  // waiting for the field to close is no longer needed.
  outlineRefreshPending = false;
  return fresh;
}

// Save a title without blocking the interaction: the line is already painted, so
// the request may finish after the field is gone. `keepalive` lets it survive a
// navigation that immediately follows the edit. Throws on a refused save, which
// the structural paths (Enter, Tab) treat as "do not continue".
async function saveTitle(id, value) {
  const res = await fetch(domainPath('/api/nodes/' + id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: value }),
    keepalive: true,
  });
  if (!res.ok) throw new Error('Renommage refusé (' + res.status + ')');
}

/* -------------------------------------------------------------------- */
/* Inline task links in titles.                                          */
/* A title may contain `[label](/domaine/<slug>?reveal=<id>#node-<id>)`. */
/* The server renders the anchors; the client uses the same grammar to    */
/* edit the source, map the caret and paste a copied task link.           */
/* -------------------------------------------------------------------- */

// Keep this source in sync with `TASK_LINK_SOURCE` in server.js.
const TASK_LINK_SOURCE =
  '\\[([^\\[\\]\\n]+)\\]\\(/domaine/([a-z0-9-]+)\\?reveal=([A-Za-z0-9-]+)#node-\\3\\)';

function taskLinkRegex() {
  return new RegExp(TASK_LINK_SOURCE, 'g');
}

// Split a title source into literal text and link segments. Each segment keeps
// its offset in the source, so the editor can map a click on the displayed text
// back to the Markdown source.
function titleSegments(source) {
  const text = String(source);
  const segments = [];
  let last = 0;
  const re = taskLinkRegex();
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', text: text.slice(last, match.index), start: last });
    }
    segments.push({
      type: 'link',
      label: match[1],
      href: `/domaine/${match[2]}?reveal=${match[3]}#node-${match[3]}`,
      start: match.index,
      end: match.index + match[0].length,
      labelStart: match.index + 1,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last), start: last });
  return segments;
}

// The text a title displays: link labels instead of their Markdown syntax.
function displayTitle(source) {
  return titleSegments(source)
    .map((segment) => (segment.type === 'link' ? segment.label : segment.text))
    .join('');
}

// Map an offset in the displayed title to the same position in the source.
function sourceOffset(source, displayOffset) {
  const segments = titleSegments(source);
  let displayed = 0;
  for (const segment of segments) {
    const length = segment.type === 'link' ? segment.label.length : segment.text.length;
    // At the right edge of a link's label, the displayed offset is ambiguous:
    // it is both the end of the label and the position just after the link.
    // A click on the label itself follows the link instead of opening the
    // edit field, so an offset that reaches this edge comes from a click
    // *after* the link: in the source it belongs after the `](url)` syntax,
    // not inside the brackets on the name. Text segments keep the boundary
    // (a click at the end of the text before a link lands just before `[`).
    const inside =
      segment.type === 'link'
        ? displayOffset < displayed + length
        : displayOffset <= displayed + length;
    if (inside) {
      const start = segment.type === 'link' ? segment.labelStart : segment.start;
      return start + (displayOffset - displayed);
    }
    displayed += length;
  }
  return String(source).length;
}

// Paint a title source into an existing span, rebuilding text nodes and
// anchors rather than injecting HTML. Keeps `data-title` in sync for the next
// edit (the server does the same rendering on a full page load).
function paintTitle(span, source) {
  const value = String(source);
  span.textContent = '';
  for (const segment of titleSegments(value)) {
    if (segment.type === 'text') {
      span.appendChild(document.createTextNode(segment.text));
    } else {
      const anchor = document.createElement('a');
      anchor.className = 'title-link';
      anchor.href = segment.href;
      anchor.draggable = false;
      anchor.textContent = segment.label;
      span.appendChild(anchor);
    }
  }
  span.dataset.title = value;
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

// The displayed previous sibling of a line: the nearest preceding line of the
// outline sharing the same parent (data-parent). Siblings are not necessarily
// adjacent in the flat rendering — a line inserted below X is displayed before
// X's own sub-lines — so the search walks backwards instead of looking at the
// immediate predecessor. It stops at the first line shallower than `line`
// (its parent, which closes the parent's region). Returns null when the line is
// the first of its siblings, which is exactly when indenting is impossible.
function previousSiblingRow(line) {
  if (!line) return null;
  const parent = line.dataset.parent || '';
  const depth = depthOf(line);
  for (let el = line.previousElementSibling; el; el = el.previousElementSibling) {
    if (!el.classList || !el.classList.contains('line')) continue;
    if (depthOf(el) < depth) break;
    if ((el.dataset.parent || '') === parent) return el;
  }
  return null;
}

// Whether the indent/outdent shortcut can move the line one level. This mirrors
// `reindentNode` on the server: indenting needs a previous sibling, outdenting
// needs a parent. It is decided here so an impossible reindent sends no request
// at all — a pointless round-trip would re-render the outline and drop the
// caret for nothing. The server keeps the last word either way.
function canReindent(line, direction) {
  if (!line) return false;
  if (direction === 'outdent') return Boolean(line.dataset.parent);
  return previousSiblingRow(line) !== null;
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
  if (node === span) {
    // The caret sits between the span's children: convert the child index to a
    // text offset (the span may contain anchors, not just one text node).
    let offset = 0;
    for (let i = 0; i < position.offset && i < span.childNodes.length; i += 1) {
      offset += (span.childNodes[i].textContent || '').length;
    }
    return offset;
  }
  if (!span.contains(node)) return null;
  let offset = position.offset;
  let prev = node.previousSibling;
  while (prev) {
    offset += (prev.textContent || '').length;
    prev = prev.previousSibling;
  }
  return offset;
}

/* The on-screen keyboard moves the viewport for a few hundred milliseconds. The
   line is revealed only once it has settled, so the page is moved once by the
   app instead of once by the browser and again by the app. */
const REVEAL_SETTLE_MS = 120;
const REVEAL_FALLBACK_MS = 350;

function prefersReducedMotion() {
  return Boolean(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// `nearest` is the whole point: a line already visible above the keyboard does
// not move at all, and a hidden one is brought just above it. The scroll pad
// (the keyboard inset) is declared on `:root` in style.css.
function revealLine(line, generation) {
  // A reveal that fires after the field closed (fast open/close) must not move
  // the page: the user is no longer editing there.
  if (generation !== editGeneration || !line.isConnected) return;
  if (!line.querySelector('.title-input')) return;
  line.scrollIntoView({
    block: 'nearest',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

// Wait for the visual viewport to stop changing (keyboard animation), then reveal
// the line once. The fallback covers engines that report no viewport event.
function scheduleReveal(line, generation) {
  if (!line) return;
  const viewport = window.visualViewport;
  if (!viewport) {
    setTimeout(() => revealLine(line, generation), REVEAL_FALLBACK_MS);
    return;
  }
  let settleTimer = 0;
  let fallbackTimer = 0;
  const fire = () => {
    clearTimeout(settleTimer);
    clearTimeout(fallbackTimer);
    viewport.removeEventListener('resize', onViewportChange);
    viewport.removeEventListener('scroll', onViewportChange);
    revealLine(line, generation);
  };
  const onViewportChange = () => {
    // A real keyboard resize is happening: rely on the debounce, not the
    // bounded wait, so a slow keyboard is not cut short.
    clearTimeout(fallbackTimer);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(fire, REVEAL_SETTLE_MS);
  };
  viewport.addEventListener('resize', onViewportChange);
  viewport.addEventListener('scroll', onViewportChange);
  fallbackTimer = setTimeout(fire, REVEAL_FALLBACK_MS);
}

function startRename(span, clientX, clientY, forceEnd, selectAll, caretAt) {
  const id = span.dataset.id;
  // The source may contain link syntax even though the span only displays the
  // labels, so the editor always starts from `data-title` when available.
  const original = span.dataset.title || span.textContent;
  // Captured by the save and structural paths: a reply whose generation is no
  // longer current belongs to a field the user has already left for another.
  const generation = ++editGeneration;
  let done = false;
  // Caret offset to restore after a keyboard reindent reopened this field.
  let reindentCaret = original.length;

  // Determine where in the title the user clicked so the edit field opens with
  // the caret at that exact position (no "select-all"). When the rename is
  // started from the line's free space (forceEnd), always open with the caret
  // after the last character. When a freshly created line is focused
  // (selectAll), the placeholder text is selected so typing replaces it.
  let caret = original.length;
  if (!forceEnd) {
    const hit = caretOffsetAtPoint(span, clientX, clientY);
    // `hit` is an offset in the displayed title; the field edits the source, so
    // a click after a link lands past the link's `](...)` syntax.
    if (hit !== null) caret = sourceOffset(original, hit);
  }
  // An explicit offset (the reindent path) wins: the title may have been
  // retyped since the click that opened the field.
  if (Number.isFinite(caretAt)) caret = Math.max(0, Math.min(caretAt, original.length));

  // Measured on the line, not on the span: it already includes the touch
  // min-height, so pinning the row to this height keeps the lines below exactly
  // where they are when the field replaces the title (and when it goes back).
  const line = span.closest('.line');
  const lineHeight = line ? line.offsetHeight : 0;

  const input = document.createElement('textarea');
  input.className = 'title-input';
  input.rows = 1;
  input.wrap = 'soft';
  input.value = original;
  input.setAttribute('aria-label', 'Titre de la tâche');
  span.replaceWith(input);
  if (line) {
    line.style.minHeight = lineHeight + 'px';
    line.classList.add('editing');
  }

  // Focus without letting the browser choose the scroll position: on a phone it
  // would pan the visual viewport (or scroll the page) before the keyboard is
  // even up, and the app would then correct a movement it did not choose.
  input.focus({ preventScroll: true });

  // The field wraps like the title did: its height follows its content, and the
  // line's min-height keeps the row from collapsing under it.
  function autosize() {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }
  autosize();
  input.addEventListener('input', autosize);

  // Apply the caret on the next frame so the browser's own focus/caret handling
  // cannot move it to the end or reset it after we set it.
  requestAnimationFrame(() => {
    if (done || !input.isConnected) return;
    if (selectAll) input.setSelectionRange(0, original.length);
    else input.setSelectionRange(caret, caret);
    autosize();
    // The line is visible in the common case, and `nearest` is then a no-op: it
    // only protects a line hidden under the sticky header before the keyboard
    // changes the viewport. The single deliberate move happens after the
    // viewport settles (see `scheduleReveal`).
    if (line) line.scrollIntoView({ block: 'nearest' });
    scheduleReveal(line, generation);
  });

  // Drop every trace of the editing mode. The class and the pinned height live on
  // the line, which outlives the field.
  function releaseEditing() {
    if (!line) return;
    line.classList.remove('editing');
    line.style.removeProperty('min-height');
  }

  const finish = async (save, next, reindent) => {
    if (done) return;
    done = true;

    const value = save ? input.value.trim() : '';
    const replacement = document.createElement('span');
    replacement.className = span.className;
    replacement.dataset.id = id;
    // Paint the source, not `textContent`: a blur without changes must not
    // leave the Markdown syntax visible in place of the link.
    paintTitle(replacement, value || original);

    input.replaceWith(replacement);
    releaseEditing();

    let titleChanged = false;
    let savePromise = null;
    if (save && value && value !== original) {
      titleChanged = true;
      savePromise = saveTitle(id, value);
    }
    if (titleChanged) document.dispatchEvent(new CustomEvent('outline:title-changed'));
    // The bar measured its height with the field open: let it remeasure now that
    // the field (and the pinned height) are gone.
    document.dispatchEvent(new CustomEvent('outline:editing-ended'));

    // Tab / Shift+Tab: move the line one level, then reopen the edit field on
    // the same line at the same caret so the shortcut can be chained. The title
    // is saved first, so the re-rendered outline carries the typed text: nothing
    // the user typed is lost.
    if (reindent) {
      try {
        if (savePromise) await savePromise;
      } catch (err) {
        console.error('Erreur renommage:', err);
        reloadOutline();
        return;
      }
      try {
        const res = await fetch(domainPath('/api/nodes/' + id + '/' + reindent), { method: 'POST' });
        if (!res.ok) throw new Error('Réindentation refusée (' + res.status + ')');
        const html = await res.text();
        if (generation !== editGeneration) {
          // Another field was opened while the request was in flight: never
          // replace the outline under it. A fresh fragment is fetched when that
          // field closes.
          outlineRefreshPending = true;
          flushOutlineRefresh();
          return;
        }
        // No outline: the page is reloading itself, nothing more to do here.
        if (!swapOutlineHtml(html)) return;
        const moved = document.querySelector('.line[data-id="' + id + '"]');
        const titleEl = moved && moved.querySelector('.title');
        if (titleEl) startRename(titleEl, 0, 0, false, false, reindentCaret);
        // No line: the reindent moved it under a collapsed parent, so it is
        // legitimately hidden now (the outline itself is up to date).
      } catch (err) {
        console.error('Erreur réindentation:', err);
        reloadOutline();
      }
      return;
    }

    // Enter: create a new line at the same level, right after this one, and
    // focus it so the user can keep typing.
    if (next) {
      try {
        if (savePromise) await savePromise;
      } catch (err) {
        console.error('Erreur renommage:', err);
        reloadOutline();
        return;
      }
      try {
        const res = await fetch(domainPath('/api/nodes/' + id + '/next'), { method: 'POST' });
        if (!res.ok) throw new Error('Création de ligne refusée (' + res.status + ')');
        const newId = res.headers.get('X-New-Node-Id');
        const html = await res.text();
        if (generation !== editGeneration) {
          outlineRefreshPending = true;
          flushOutlineRefresh();
          return;
        }
        if (!swapOutlineHtml(html)) return;
        if (newId) {
          const newLine = document.querySelector('.line[data-id="' + newId + '"]');
          const newTitle = newLine && newLine.querySelector('.title');
          if (newTitle) startRename(newTitle, 0, 0, true, true);
        }
      } catch (err) {
        console.error('Erreur création ligne:', err);
        reloadOutline();
      }
      return;
    }

    // Plain save: the line is already painted and the field is gone. The request
    // finishes in the background and the outline is NOT re-rendered here: that
    // swap used to happen exactly when the keyboard closes, and it could destroy
    // a field opened on another line before the save completed.
    if (savePromise) {
      savePromise
        .catch((err) => console.error('Erreur renommage:', err))
        .finally(flushOutlineRefresh);
    } else {
      flushOutlineRefresh();
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true, true);
    } else if (e.key === 'Escape') {
      finish(false);
    } else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Tab indents the line being edited, Shift+Tab outdents it. The default
      // is always prevented: otherwise Tab would blur the field and commit the
      // line, the opposite of what an outliner user expects. Modifier
      // combinations keep their browser meaning (Ctrl+Tab switches tabs).
      e.preventDefault();
      // The event must not reach the document listener below: `finish` removes
      // this field synchronously, so by the time the event bubbles the focus is
      // back on <body> and a selected line would be reindented a second time.
      e.stopPropagation();
      const direction = e.shiftKey ? 'outdent' : 'indent';
      if (!canReindent(line, direction)) return; // impossible: stay put, silently
      reindentCaret = input.selectionStart === null ? original.length : input.selectionStart;
      finish(true, false, direction);
    }
  });
  input.addEventListener('blur', () => finish(true));
}

// A touch drag ends with a click on the bullet that started it (pointer capture
// retargets the release): swallow that one, or the gesture that just moved the
// line would also select it. The deadline keeps the flag from outliving the
// click it targets when the browser sends none.
let suppressClickUntil = 0;

// The collapse gesture is a double click on the selection button. It is
// detected from two `click` events rather than from the native `dblclick`
// event: the first click swaps the dot for the grip (and hides the collapsed
// ring), so the second click may land on a different glyph — and some
// environments then dispatch no `dblclick` at all, while touch double-taps
// rarely synthesize one. Two clicks on the same bullet, close in time and
// place, are exactly the user's double click.
const DOUBLE_CLICK_MS = 500;
const DOUBLE_CLICK_SLOP = 8;
let lastBulletClick = null; // { id, at, x, y }

function toggleLineCollapse(line) {
  if (!window.htmx) return;
  htmx.ajax('POST', domainPath('/api/nodes/' + line.dataset.id + '/toggle'), {
    target: '#outline',
    swap: 'outerHTML',
  });
}

document.addEventListener('click', (e) => {
  const bullet = e.target.closest('.bullet');
  if (bullet && suppressClickUntil > performance.now()) {
    suppressClickUntil = 0;
    lastBulletClick = null;
    e.preventDefault();
    return;
  }
  if (bullet) {
    const line = bullet.closest('.line');
    if (line) {
      // A second click on the same bullet is the collapse/expand gesture; it
      // must not also move the selection to the next stage.
      const now = performance.now();
      const previous = lastBulletClick;
      lastBulletClick = { id: line.dataset.id, at: now, x: e.clientX, y: e.clientY };
      if (
        previous &&
        previous.id === line.dataset.id &&
        now - previous.at <= DOUBLE_CLICK_MS &&
        Math.hypot(e.clientX - previous.x, e.clientY - previous.y) <= DOUBLE_CLICK_SLOP
      ) {
        lastBulletClick = null;
        toggleLineCollapse(line);
        return;
      }

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

  // A click elsewhere breaks any pending double click on a bullet.
  lastBulletClick = null;

  // A link inside the title owns the click: the browser follows it, and the
  // rename field must not open. Renaming stays available on the text outside
  // the link, on the line's free space, or from the context menu.
  if (e.target.closest('.title a')) return;

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

// Re-apply the head selection after the outline was replaced by a
// server-rendered fragment: the selection lives in the DOM, which the fragment
// wipes out, so it is captured before the request and put back here. The
// selection button is focused again too, so the shortcut can be pressed a
// second time without another click.
function restoreHeadSelection(line, groupSelected) {
  document.querySelectorAll('.line.selected, .line.selected-head').forEach((l) => {
    l.classList.remove('selected');
    l.classList.remove('selected-head');
  });
  const targets = groupSelected ? [line, ...subtreeRows(line)] : [line];
  targets.forEach((l) => l.classList.add('selected'));
  line.classList.add('selected-head');
  const bullet = line.querySelector('.bullet');
  if (bullet) bullet.focus();
}

// Tab / Shift+Tab on a selected line (not being edited). The title edit field
// has its own handler: this one only runs when no field owns the focus, which
// is exactly the "line selected, not editing" context. Everything else keeps
// the browser's normal tab navigation, and a line is never touched from outside
// the outline.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
  const focused = document.activeElement;
  if (focused && focused.closest && focused.closest('input, textarea, select, [contenteditable]')) {
    return;
  }
  // An open title field owns Tab, even if it is not the focused element any
  // more: reindenting here as well would move the line twice.
  if (document.querySelector('.title-input')) return;
  const outline = document.querySelector('#outline');
  const line = outline && outline.querySelector('.line.selected-head');
  if (!line || !line.dataset.id) return;

  const direction = e.shiftKey ? 'outdent' : 'indent';
  // The focus never moves, even when the reindent is impossible: Tab is ours
  // here, it does not mean "next control".
  e.preventDefault();
  if (!canReindent(line, direction)) return;

  const id = line.dataset.id;
  // Whether the head line's sub-lines are selected (the group state) must
  // survive the re-render as well.
  const groupSelected = subtreeRows(line).some((row) => row.classList.contains('selected'));

  fetch(domainPath('/api/nodes/' + id + '/' + direction), { method: 'POST' })
    .then((res) => {
      if (!res.ok) throw new Error('Réindentation refusée (' + res.status + ')');
      return res.text();
    })
    .then((html) => {
      if (!swapOutlineHtml(html)) return;
      const moved = document.querySelector('.line[data-id="' + id + '"]');
      // No line: the reindent moved it under a collapsed parent, so it is
      // legitimately hidden now (the outline itself is up to date).
      if (moved) restoreHeadSelection(moved, groupSelected);
    })
    .catch((err) => {
      console.error('Erreur réindentation:', err);
      reloadOutline();
    });
});

// Close the context menu (and clear the selection) when the pointer leaves the
// selected head line. The menu is a child of the line and is anchored above it,
// so moving between the line and its menu (or across the menu's hover-bridge)
// is NOT "leaving the line" — the selection only clears once the pointer truly
// moves off the head line (e.g. onto a sub-line, a neighbour, or off the list).
document.addEventListener('mouseout', (e) => {
  const head = e.target.closest('.line.selected-head');
  if (!head) return;
  // Re-rendering the outline removes the line the pointer was on, which makes
  // the browser report the pointer leaving *that* (now detached) line. The user
  // did not move: the selection that the re-render just restored must survive,
  // otherwise the context menu closes by itself.
  if (!head.isConnected) return;
  const to = e.relatedTarget;
  // Still inside the line (a sub-element, the menu, or its hover-bridge).
  if (to && head.contains(to)) return;
  document.querySelectorAll('.line.selected, .line.selected-head').forEach((l) => {
    l.classList.remove('selected');
    l.classList.remove('selected-head');
  });
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
function positionAtPoint(clientY, line) {
  const rect = line.getBoundingClientRect();
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'inside';
}

function positionAt(e, line) {
  return positionAtPoint(e.clientY, line);
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

// One move request, shared by the HTML5 drop and the touch drag: same route,
// same body, same re-render.
function moveLine(sourceId, target, position) {
  const targetId = target.kind === 'line' ? target.line.dataset.id : null;
  fetch(domainPath('/api/nodes/' + sourceId + '/move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId, position }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('Déplacement refusé (' + res.status + ')');
      reloadOutline();
    })
    .catch((err) => console.error('Erreur déplacement:', err));
}

document.addEventListener('drop', (e) => {
  if (!dragSourceId) return;
  const target = resolveDropTarget(e.target);
  if (!target) return;
  if (isInvalidDrop(target)) return;

  e.preventDefault();
  clearDropIndicators();

  const position = target.kind === 'line' ? positionAt(e, target.line) : 'inside';
  moveLine(dragSourceId, target, position);
});

document.addEventListener('dragend', () => {
  if (dragSourceLine) dragSourceLine.classList.remove('dragging');
  dragSourceLine = null;
  dragSourceId = null;
  clearDragGhost();
  clearDropIndicators();
});

/* -------------------------------------------------------------------- */
/* Touch drag: the same move, started from the handle with a finger.    */
/* HTML5 drag events never fire for touch, so the gesture is driven by  */
/* Pointer Events. The drop resolution, the indicators, the refusal of  */
/* a descendant target and the /move request are the ones the HTML5     */
/* path already uses (see above), so both gestures stay in sync.        */
/* -------------------------------------------------------------------- */

// 8px is the usual tap tolerance: below it the gesture is a tap (select),
// above it the line is being moved.
const TOUCH_DRAG_THRESHOLD = 8;
// Auto-scroll band at the top and bottom of the viewport, and its peak speed in
// CSS pixels per animation frame (~840px/s at 60fps). Without it, a phone could
// only move a line within the dozen rows it displays.
const TOUCH_SCROLL_ZONE = 72;
const TOUCH_SCROLL_STEP = 14;

// The gesture in progress, if any.
let touchDrag = null;
// Floating clone shown above the finger.
let touchGhost = null;

function touchScrollStep(y) {
  const bottom = window.innerHeight - TOUCH_SCROLL_ZONE;
  if (y < TOUCH_SCROLL_ZONE) {
    return -Math.ceil(((TOUCH_SCROLL_ZONE - y) / TOUCH_SCROLL_ZONE) * TOUCH_SCROLL_STEP);
  }
  if (y > bottom) {
    return Math.ceil(((y - bottom) / TOUCH_SCROLL_ZONE) * TOUCH_SCROLL_STEP);
  }
  return 0;
}

// Park the ghost above the finger so the hand does not hide what is being
// dragged, clamped to the top of the viewport.
function placeTouchGhost(x, y) {
  if (!touchGhost) return;
  const height = touchGhost.offsetHeight || 0;
  touchGhost.style.left = Math.round(x + 12) + 'px';
  touchGhost.style.top = Math.max(8, Math.round(y - height - 16)) + 'px';
}

// Resolve the line under the finger, highlight it and remember the insertion
// point. `target` stays null when nothing can receive the drop.
function updateTouchTarget(x, y) {
  clearDropIndicators();
  touchDrag.target = null;
  touchDrag.position = null;
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const target = resolveDropTarget(el);
  if (!target) return;
  if (isInvalidDrop(target)) {
    if (target.kind === 'line') target.line.classList.add('drop-invalid');
    return;
  }
  touchDrag.target = target;
  if (target.kind === 'line') {
    touchDrag.position = positionAtPoint(y, target.line);
    target.line.classList.add('drop-target', 'drop-' + touchDrag.position);
  } else {
    touchDrag.position = 'inside';
    target.outline.classList.add('drop-root');
  }
}

function updateTouchDrag(x, y) {
  touchDrag.x = x;
  touchDrag.y = y;
  placeTouchGhost(x, y);
  updateTouchTarget(x, y);
}

function startTouchDrag() {
  touchDrag.active = true;
  // The HTML5 handlers key their refusals on these two: sharing them keeps
  // `isInvalidDrop` (self / descendant) working for the touch gesture too.
  dragSourceId = touchDrag.line.dataset.id;
  dragSourceLine = touchDrag.line;
  touchDrag.line.classList.add('dragging');
  touchGhost = buildDragGhost(touchDrag.line);
  touchGhost.classList.add('floating');
  placeTouchGhost(touchDrag.x, touchDrag.y);

  const tick = () => {
    if (!touchDrag || !touchDrag.active) return;
    const dy = touchScrollStep(touchDrag.y);
    if (dy !== 0) {
      window.scrollBy(0, dy);
      updateTouchTarget(touchDrag.x, touchDrag.y);
    }
    touchDrag.raf = requestAnimationFrame(tick);
  };
  touchDrag.raf = requestAnimationFrame(tick);
}

function endTouchDrag() {
  if (!touchDrag) return;
  if (touchDrag.raf) cancelAnimationFrame(touchDrag.raf);
  if (touchGhost) {
    touchGhost.remove();
    touchGhost = null;
  }
  if (touchDrag.line) touchDrag.line.classList.remove('dragging');
  if (touchDrag.bullet) {
    touchDrag.bullet.draggable = touchDrag.wasDraggable;
    try {
      touchDrag.bullet.releasePointerCapture(touchDrag.pointerId);
    } catch (err) {
      /* the capture may already be gone */
    }
  }
  clearDropIndicators();
  dragSourceId = null;
  dragSourceLine = null;
  touchDrag = null;
}

document.addEventListener('pointerdown', (e) => {
  // The mouse keeps the native HTML5 drag: mixing the two paths on one device
  // would start two drags at once.
  if (e.pointerType === 'mouse') return;
  const bullet = e.target.closest('.bullet');
  if (!bullet) return;
  const line = bullet.closest('.line');
  if (!line || !line.dataset.id || touchDrag) return;

  touchDrag = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    active: false,
    bullet,
    line,
    target: null,
    position: null,
    raf: null,
    wasDraggable: bullet.draggable,
  };
  // A native drag would compete with the pointer drag on iPadOS.
  bullet.draggable = false;
  try {
    bullet.setPointerCapture(e.pointerId);
  } catch (err) {
    /* capture is a best effort: the document listeners still see the moves */
  }
});

document.addEventListener('pointermove', (e) => {
  if (!touchDrag || e.pointerId !== touchDrag.pointerId) return;
  if (!touchDrag.active) {
    const dx = e.clientX - touchDrag.startX;
    const dy = e.clientY - touchDrag.startY;
    if (Math.hypot(dx, dy) < TOUCH_DRAG_THRESHOLD) return;
    touchDrag.x = e.clientX;
    touchDrag.y = e.clientY;
    startTouchDrag();
  }
  updateTouchDrag(e.clientX, e.clientY);
});

document.addEventListener('pointerup', (e) => {
  if (!touchDrag || e.pointerId !== touchDrag.pointerId) return;
  const wasDragging = touchDrag.active;
  const sourceId = touchDrag.line.dataset.id;
  const target = touchDrag.target;
  const position = touchDrag.position;
  endTouchDrag();

  // A tap: let the click select the line, as it always did.
  if (!wasDragging) return;
  // The release still produces a click on the bullet through the capture; it
  // must not toggle the selection that the drag deliberately left untouched.
  suppressClickUntil = performance.now() + 400;
  if (target && position) moveLine(sourceId, target, position);
});

// The browser took the gesture back (scroll, system gesture, view change):
// cancel without moving anything.
document.addEventListener('pointercancel', (e) => {
  if (!touchDrag || e.pointerId !== touchDrag.pointerId) return;
  endTouchDrag();
});

/* -------------------------------------------------------------------- */
/* Sidebar: toggle collapse + fold after a page entry on a phone.        */
/* The collapsed state is persisted in localStorage so it survives       */
/* navigation (each page is a full load and re-applies the state).       */
/* -------------------------------------------------------------------- */

// The window width under which the app treats the screen as a phone, i.e. the
// same 640px breakpoint as the outline's narrow-screen rules.
const SIDEBAR_NARROW = '(max-width: 640px)';

// The fold happens on the page that was just opened, never on the page being
// left: the new page is shown first, then the panel tucks itself away. The
// intent travels across the full load in sessionStorage, and the fold starts
// once the content's fade (`page-fade-in`, .2s in style.css) is over, with a
// short pause so the two movements never overlap.
const SIDEBAR_COLLAPSE_FLAG = 'sidebarCollapseOnLoad';
const SIDEBAR_COLLAPSE_DELAY_MS = 300;
// A fold request is only meaningful for the navigation it was made for: if the
// navigation never completed (cancelled, blocked), the stale request must not
// fold the panel of an unrelated page opened later.
const SIDEBAR_COLLAPSE_FLAG_TTL_MS = 15000;

// One state, one key: the toggle and the automatic close after a page entry
// both go through here, so the panel can never hold two different states.
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '');
}

function applySidebarState() {
  let pendingFold = null;
  try {
    pendingFold = sessionStorage.getItem(SIDEBAR_COLLAPSE_FLAG);
    if (pendingFold) sessionStorage.removeItem(SIDEBAR_COLLAPSE_FLAG);
  } catch (err) {
    // Storage unavailable (private mode, embedded frame): behave as before.
  }
  const requestedAt = Number(pendingFold);

  if (pendingFold && Date.now() - requestedAt < SIDEBAR_COLLAPSE_FLAG_TTL_MS) {
    // The page has appeared; the panel can fold. Reduced motion applies the
    // state without a movement, so the page simply arrives collapsed.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSidebarCollapsed(true);
    } else {
      window.setTimeout(() => setSidebarCollapsed(true), SIDEBAR_COLLAPSE_DELAY_MS);
    }
    return;
  }

  if (localStorage.getItem('sidebarCollapsed') === '1') {
    document.body.classList.add('sidebar-collapsed');
  }
}

const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  });
}

// Any panel entry that opens a page closes the panel on a phone, so the page
// that was asked for gets the whole width. Every anchor in the panel is such an
// entry — home, a domain, administration, help, passkeys — while the commands
// that do not navigate are a button and a form, excluded by construction. The
// link is followed at once: the destination page renders with the panel open
// and fades in, then folds the panel. A modified click (new tab, new window)
// leaves the current page's panel alone.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest && e.target.closest('#sidebar a[href]');
  if (!link) return;
  if (!window.matchMedia(SIDEBAR_NARROW).matches) return;

  // Already folded: the destination reads the persisted state, nothing to ask.
  if (document.body.classList.contains('sidebar-collapsed')) return;

  // The passkeys screen has no panel of its own, so there is nothing to fold
  // there: persist the state now instead of leaving a pending fold for the
  // next page that happens to show the panel.
  const target = new URL(link.href, window.location.href);
  if (target.pathname.startsWith('/auth/')) {
    setSidebarCollapsed(true);
    return;
  }

  try {
    sessionStorage.setItem(SIDEBAR_COLLAPSE_FLAG, String(Date.now()));
  } catch (err) {
    // Without storage the intent cannot travel: fold the panel right here, as
    // before, rather than not folding at all.
    setSidebarCollapsed(true);
  }
});

/* -------------------------------------------------------------------- */
/* Sticky ancestry: the domain name and the chain of parent tasks of the */
/* first visible line stay pinned while the outline scrolls, so a deep   */
/* sub-task never loses its context. The chain is read from the rendered */
/* DOM (`data-parent` and `.title`), so it never costs a request.        */
/* -------------------------------------------------------------------- */

(function initStickyAncestry() {
  const bar = document.getElementById('ancestry');
  const topbar = document.getElementById('topbar');
  if (!bar || !topbar) return;

  let outlineEl = null;
  let lines = [];
  let byId = new Map();
  // Ids of the displayed tasks that have a displayed child. A task in this set
  // is a mother the lines below depend on, so its own label must stay readable
  // while its row crosses the bar (see `update`).
  let mothers = new Set();
  let signature = null;
  let reserve = 0;
  let reserveDepth = -1;
  let reserveWidth = -1;

  // The outline is replaced by htmx after most actions: the element identity is
  // the cheapest reliable signal that the cached lines are stale.
  function refreshIndex() {
    const outline = document.getElementById('outline');
    if (outline === outlineEl) return;
    outlineEl = outline;
    lines = outline ? Array.from(outline.querySelectorAll('.line')) : [];
    byId = new Map(lines.map((el) => [el.dataset.id, el]));
    mothers = new Set(lines.map((el) => el.dataset.parent).filter(Boolean));
    signature = null;
    reserveDepth = -1;
  }

  // Height of the tallest chain the outline can display, measured once per
  // outline and per width. The page reserves it at the bottom (see
  // `body.has-labels-bar main`), so growing or shrinking the header never
  // changes the document's total height — otherwise the scroll would be clamped
  // at the end of the page and the chain would oscillate.
  function refreshReserve() {
    const maxDepth = lines.reduce(
      (max, el) => Math.max(max, Number(el.dataset.depth) || 0),
      0
    );
    const width = topbar.clientWidth;
    if (maxDepth === reserveDepth && width === reserveWidth) return;
    reserveDepth = maxDepth;
    reserveWidth = width;
    if (!maxDepth) {
      reserve = 0;
      return;
    }
    const probe = document.createElement('div');
    probe.className = 'ancestry';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.maxHeight = 'none';
    probe.style.width = width + 'px';
    for (let depth = 0; depth < maxDepth; depth++) {
      const item = document.createElement('a');
      item.className = 'ancestry-item';
      item.style.setProperty('--pin-fraction', '1');
      const row = document.createElement('span');
      row.className = 'ancestry-row';
      row.style.setProperty('--depth', String(depth));
      row.textContent = 'X';
      item.append(row);
      probe.append(item);
    }
    topbar.append(probe);
    // The live panel is capped at 40vh; a deeper chain scrolls inside it.
    reserve = Math.min(probe.getBoundingClientRect().height, window.innerHeight * 0.4);
    probe.remove();
  }

  function labelOf(lineEl) {
    const title = lineEl.querySelector('.title');
    return title ? title.textContent.trim() : '';
  }

  // The ancestors of `lineEl`, from the top-level project down to its immediate
  // parent. A visible line's ancestors are always in the DOM: a collapsed
  // ancestor would have hidden it.
  function ancestryOf(lineEl) {
    const chain = [];
    const seen = new Set();
    let id = lineEl.dataset.parent;
    while (id && !seen.has(id)) {
      seen.add(id);
      const parent = byId.get(id);
      if (!parent) break;
      chain.unshift(parent);
      id = parent.dataset.parent;
    }
    return chain;
  }

  // The first line whose bottom edge is below the bar: the line being read.
  // Lines are in display order, so their vertical positions are increasing and
  // a binary search finds it in logarithmic time even in a huge outline.
  function firstVisibleLine(barBottom) {
    let low = 0;
    let high = lines.length - 1;
    let found = null;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const rect = lines[middle].getBoundingClientRect();
      if (rect.bottom > barBottom) {
        found = lines[middle];
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return found;
  }

  // The chain of tasks shown under the domain name, and the hidden part of its
  // last row. It is the ancestry of the line being read plus, when that line is
  // a mother whose title is straddling the bar, the line itself: its children
  // are still displayed below it, so its label is the context of what follows.
  // The fraction is the hidden part of the reading line's title (0 when it is
  // fully visible, 1 when it is fully behind the bar); the last crumb shows that
  // hidden fragment at the bar's bottom, while the line below shows the rest, so
  // the label is split by the separator instead of being duplicated or missing.
  function chainOf(first, barBottom) {
    if (!first) return { chain: [], fraction: 1 };
    const chain = ancestryOf(first);
    let fraction = 1;
    if (mothers.has(first.dataset.id)) {
      const title = first.querySelector('.title');
      const rect = title ? title.getBoundingClientRect() : first.getBoundingClientRect();
      const hidden = (barBottom - rect.top) / Math.max(rect.height, 1);
      // A tiny slack keeps the first line of a page (its title exactly on the
      // header's bottom edge) from being treated as hidden.
      if (hidden > 0.001) {
        chain.push(first);
        fraction = Math.min(1, hidden);
      }
    }
    return { chain, fraction };
  }

  // One pinned row per task, reused across updates so a crumb that stays in the
  // chain is never detached and re-created (which would blink on every scroll).
  let crumbById = new Map();

  function crumbFor(lineEl, label) {
    const id = lineEl.dataset.id;
    let item = crumbById.get(id);
    if (!item) {
      item = document.createElement('a');
      item.className = 'ancestry-item';
      const row = document.createElement('span');
      row.className = 'ancestry-row';
      const bullet = document.createElement('span');
      bullet.className = 'ancestry-bullet';
      bullet.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'ancestry-label';
      row.append(bullet, text);
      item.append(row);
      item._row = row;
      item._label = text;
      crumbById.set(id, item);
    }
    item.href = '#node-' + id;
    item.title = label;
    item._label.textContent = label;
    // The pinned row uses the line's own depth, so its bullet slot and title
    // start exactly where the visible sub-tasks' bullet and title start.
    const depth = String(Number(lineEl.dataset.depth) || 0);
    item._row.style.setProperty('--depth', depth);
    // The same depth as an attribute, for the CSS that shifts the first-rank
    // lines on a narrow screen: a custom property cannot be tested by a
    // selector, and a pinned project must take the same shift as its line.
    item._row.dataset.depth = depth;
    return item;
  }

  function renderChain(chain, fraction) {
    // The labels take part in the signature: renaming an ancestor re-renders
    // the outline without changing the chain's ids, and the crumb must follow.
    const labels = chain.map(labelOf);
    const key = chain.map((el, index) => el.dataset.id + ':' + labels[index]).join('/');
    let changed = false;
    if (key !== signature) {
      changed = true;
      signature = key;
      const keep = new Set(chain.map((el) => el.dataset.id));
      for (const [id, item] of crumbById) {
        if (keep.has(id)) continue;
        item.remove();
        crumbById.delete(id);
      }
      chain.forEach((lineEl, index) => bar.append(crumbFor(lineEl, labels[index])));
    }
    // The last crumb is the one straddling the bar: its content is clipped to
    // the hidden part of the reading line's title, so the separator and the
    // list behind it glide instead of jumping, and the label is handed over
    // instead of being duplicated or dropped.
    chain.forEach((lineEl, index) => {
      const item = crumbById.get(lineEl.dataset.id);
      if (!item) return;
      const fragment = index === chain.length - 1 ? fraction : 1;
      item.style.setProperty('--pin-fraction', String(fragment));
      item.classList.toggle('is-partial', fragment < 0.999);
    });
    return changed;
  }

  // Animate the bar from its current height to the height its new content
  // needs, so the list glides by one line instead of jumping. The previous
  // height is captured before the crumb is added or removed.
  let heightReady = false;
  let lastInnerHeight = 0;
  function sizeBar(previous) {
    bar.style.height = 'auto';
    const target = bar.offsetHeight;
    if (!heightReady) {
      heightReady = true;
      bar.style.height = target + 'px';
      return target;
    }
    if (Math.abs(target - previous) < 0.5) {
      bar.style.height = target + 'px';
      return target;
    }
    bar.style.height = previous + 'px';
    // Flush the starting height so the transition has a value to animate from.
    void bar.offsetHeight;
    bar.style.height = target + 'px';
    return target;
  }

  let pending = false;
  // Final height of the bar after the current transition. The header height is
  // published from this target, not from the animating value, so an anchor
  // clicked while the bar moves still lands below the final bar.
  let barTarget = 0;
  function update() {
    pending = false;
    refreshIndex();
    // While a title is being edited, the bar keeps the height it had when the
    // field opened: on the engines that resize the layout viewport for the
    // keyboard (older Chrome, Firefox Android, WebView), remeasuring now would
    // resize the bar and push the outline while the user is typing. The scroll
    // still moves the chain; only the height is frozen.
    const editing = Boolean(document.querySelector('.title-input'));
    if (!editing) refreshReserve();
    const rect = topbar.getBoundingClientRect();
    topbar.classList.toggle('is-stuck', rect.top <= 0);
    const first = firstVisibleLine(rect.bottom);
    const { chain, fraction } = chainOf(first, rect.bottom);
    const previousBarHeight = bar.offsetHeight;
    const chainChanged = renderChain(chain, fraction);
    if (chainChanged || (!editing && window.innerHeight !== lastInnerHeight)) {
      lastInnerHeight = window.innerHeight;
      barTarget = sizeBar(previousBarHeight);
      // The bottom reserve follows the same transition, so the document height
      // stays constant while the list glides.
      document.documentElement.style.setProperty('--chain-height', barTarget + 'px');
    }
    // The topbar's height minus the bar's current (possibly animating) height
    // is constant; adding the target gives the height the header will settle at.
    const headerHeight = topbar.offsetHeight - bar.offsetHeight + barTarget;
    // Published for `.line { scroll-margin-top }`: an anchored line must stop
    // below the whole stack, not under it.
    document.documentElement.style.setProperty('--topbar-height', headerHeight + 'px');
    // The bottom reserve keeps the document height constant while the chain
    // grows or shrinks (see `refreshReserve`).
    document.documentElement.style.setProperty('--chain-reserve', reserve + 'px');
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // A locally painted title (or the end of an edit) changes the labels the bar
  // shows, and releases the height it froze: recompute once the DOM is settled.
  document.addEventListener('outline:title-changed', schedule);
  document.addEventListener('outline:editing-ended', schedule);
  // Collapsing the sidebar widens the column, so wrapped titles move the rows:
  // recompute once the new layout is in place.
  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', schedule);
  if (window.htmx) {
    // An action re-renders the outline in place, and no scroll event follows.
    document.body.addEventListener('htmx:afterSwap', schedule);
    document.body.addEventListener('htmx:afterSettle', schedule);
  }
  schedule();
})();

/* -------------------------------------------------------------------- */
/* Keyboard inset: the part of the layout viewport hidden by the phone's */
/* on-screen keyboard, published for `scroll-padding-bottom` (style.css).*/
/* `resizes-visual` engines (iOS, Chrome 108+) leave `innerHeight`       */
/* unchanged and shrink the visual viewport; `resizes-content` engines   */
/* shrink both, and the inset is then 0. A pinch zoom is not a keyboard. */
/* -------------------------------------------------------------------- */

(function initKeyboardInset() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;

  function publish() {
    if (viewport.scale !== 1) {
      root.style.setProperty('--keyboard-inset', '0px');
      return;
    }
    const inset = Math.max(0, window.innerHeight - (viewport.offsetTop + viewport.height));
    root.style.setProperty('--keyboard-inset', inset + 'px');
  }

  viewport.addEventListener('resize', publish);
  viewport.addEventListener('scroll', publish);
  publish();
})();

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

// Rename from the context menu. This is the only way to reach the edit field
// when a whole title is an inline task link (no text or free space left to
// click), so it matters on every viewport, touch included.
document.addEventListener('click', (e) => {
  const renameBtn = e.target.closest('.menu-item.rename');
  if (!renameBtn) return;
  const line = renameBtn.closest('.line');
  const titleEl = line && line.querySelector('.title');
  if (titleEl && !titleEl.dataset.editing) startRename(titleEl, 0, 0, true);
});

// Add a sub-task from the context menu. This action is not driven by htmx: the
// client needs the new node's id (X-New-Node-Id) to open its title in edit mode
// with the default text selected, so naming it needs no extra click.
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('.menu-item.add-child');
  if (!addBtn) return;
  const line = addBtn.closest('.line');
  if (!line || !line.dataset.id) return;
  addChildLine(line.dataset.id);
});

async function addChildLine(parentId) {
  // Keep an active deep-link reveal across the re-render, as htmx requests do.
  const reveal = new URLSearchParams(location.search).get('reveal');
  const url = domainPath('/api/nodes') + (reveal ? '?reveal=' + encodeURIComponent(reveal) : '');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId }),
    });
    if (!res.ok) throw new Error('Création de tâche refusée (' + res.status + ')');
    const newId = res.headers.get('X-New-Node-Id');
    const html = await res.text();
    if (!swapOutlineHtml(html)) return;
    if (!newId) return;
    const newLine = document.querySelector('.line[data-id="' + newId + '"]');
    const newTitle = newLine && newLine.querySelector('.title');
    // The whole default title is selected, so typing replaces "Nouvelle tâche".
    if (newTitle) startRename(newTitle, 0, 0, true, true);
  } catch (err) {
    console.error('Erreur création tâche:', err);
    reloadOutline();
  }
}

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
/* Paste a copied task link into a title.                                */
/* The pasted URL is replaced by `[target title](deep link)`, so the line */
/* shows a named hyperlink instead of a raw address. Any other paste      */
/* keeps the browser's native behaviour.                                 */
/* -------------------------------------------------------------------- */

// A copied task link is an internal deep link whose `reveal` parameter and
// fragment carry the same node id. Anything else is not a task link.
function parseTaskLink(raw) {
  const text = String(raw).trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(text, location.origin);
  } catch (err) {
    return null;
  }
  if (url.origin !== location.origin) return null;
  const path = /^\/domaine\/([a-z0-9-]+)$/.exec(url.pathname);
  const fragment = /^#node-([A-Za-z0-9-]+)$/.exec(url.hash);
  const reveal = url.searchParams.get('reveal');
  if (!path || !fragment || !reveal || reveal !== fragment[1]) return null;
  return {
    slug: path[1],
    id: reveal,
    href: `/domaine/${path[1]}?reveal=${reveal}#node-${reveal}`,
  };
}

// The label of a node already rendered in the current outline, if any. A line
// hidden under a collapsed ancestor (or a target in another domain) is absent
// from the DOM: null, and the caller falls back to the API.
function taskLabelFromDom(slug, id) {
  if (slug !== activeSlug) return null;
  const line = document.querySelector(`#outline .line[data-id="${id}"]`);
  const titleEl = line && line.querySelector('.title');
  if (!titleEl) return null;
  const label = displayTitle(titleEl.dataset.title || titleEl.textContent).trim();
  return label || null;
}

async function resolveTaskLabel(slug, id) {
  const fromDom = taskLabelFromDom(slug, id);
  if (fromDom) return fromDom;
  try {
    const res = await fetch(`/domaine/${slug}/api/nodes/${id}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const label = displayTitle(data && data.title ? data.title : '').trim();
    return label || null;
  } catch (err) {
    return null;
  }
}

document.addEventListener('paste', (e) => {
  const input = e.target.closest && e.target.closest('.title-input');
  if (!input || !e.clipboardData) return;
  const raw = e.clipboardData.getData('text/plain');
  const link = parseTaskLink(raw);
  if (!link) return;

  // The label may need a request, so the native paste is cancelled now; the
  // text is inserted once the target title is known, or as a safe fallback.
  e.preventDefault();
  const start = input.selectionStart === null ? input.value.length : input.selectionStart;
  const end = input.selectionEnd === null ? start : input.selectionEnd;

  resolveTaskLabel(link.slug, link.id).then((label) => {
    if (!input.isConnected) return;
    const usable = label && !/[\[\]\r\n]/.test(label);
    const snippet = usable ? `[${label}](${link.href})` : String(raw).trim();
    input.setRangeText(snippet, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
});

/* -------------------------------------------------------------------- */
/* Themes: the labels bar of a domain page.                              */
/* The bar is re-rendered by htmx after every attach/detach, so the add   */
/* control is delegated instead of being bound once at load time.         */
/* -------------------------------------------------------------------- */

document.addEventListener('click', (e) => {
  const button = e.target.closest('#label-add-btn');
  if (!button) return;
  const form = document.getElementById('label-attach-form');
  if (!form) return;
  form.hidden = !form.hidden;
  button.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
  const select = form.querySelector('select');
  if (select && !form.hidden) select.focus();
});

applySidebarState();
// Enable the panel's transition only once the persisted state is painted: a
// page that arrives with the panel already collapsed must not replay the
// collapse. From the next frame on, a click animates it.
requestAnimationFrame(() => document.body.classList.add('sidebar-ready'));

// An expired session must send the browser back to the home page instead of
// letting a 401 body be swapped into #outline. The server sets HX-Redirect on
// htmx requests; this is the fallback when a response carries no such header.
document.body.addEventListener('htmx:responseError', (e) => {
  if (e.detail && e.detail.xhr && e.detail.xhr.status === 401) {
    window.location.href = '/';
  }
});

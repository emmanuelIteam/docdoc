//! docdoc — outliner de gestion de projets personnels.
//!
//! Portage Rust du serveur Node.js décrit dans `../README.md`. Le découpage suit
//! celui de l'original :
//!
//! - [`config`] : lecture de `.env` et de l'environnement ;
//! - [`model`] : domaines, arbre des tâches et ordre d'affichage ;
//! - [`storage`] : stockage objet compatible S3 (SigV4), ou mémoire ;
//! - [`accounts`], [`otp`], [`passkey`], [`session`] : l'accès ;
//! - [`mailer`], [`migration`] : les services autour ;
//! - [`html`] : les pages et fragments rendus côté serveur ;
//! - [`app`] : le routeur HTTP et les handlers.

pub mod accounts;
pub mod app;
pub mod config;
pub mod html;
pub mod mailer;
pub mod migration;
pub mod model;
pub mod otp;
pub mod passkey;
pub mod session;
pub mod space;
pub mod storage;

pub use app::{build_router, AppState};
pub use config::Config;

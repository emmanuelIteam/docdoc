//! Point d'entrée du serveur docdoc.

use docdoc::{build_router, AppState, Config};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = match Config::load() {
        Ok(config) => config,
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(1);
        }
    };
    let port = config.port;
    let bind_host = config.bind_host.clone();
    let is_production = config.is_production;
    let fixed_relying_party = config.has_fixed_relying_party();

    let state = AppState::new(config);
    if let Err(err) = state.storage.ensure_ready().await {
        eprintln!("Erreur au démarrage : {err}");
        std::process::exit(1);
    }

    state.mailer.warn_if_misconfigured(is_production);
    println!("Envoi des codes : {}", state.mailer.describe());
    if !fixed_relying_party {
        if is_production {
            eprintln!(
                "⚠ RP_ID / RP_ORIGIN sont obligatoires en production : les passkeys ne peuvent pas être enregistrées ni utilisées."
            );
        } else {
            println!(
                "Passkeys : RP ID et origine déduits de l’adresse utilisée (mode développement) — \
                 ouvrez l’application toujours par la même adresse."
            );
        }
    } else {
        println!(
            "Passkeys : RP ID « {} », origine « {} »",
            state.config.rp_id.as_deref().unwrap_or(""),
            state.config.rp_origin.as_deref().unwrap_or("")
        );
    }
    if state.storage.is_configured() {
        println!("Données persistées dans {}", state.storage.describe());
    } else {
        eprintln!(
            "⚠ S3 non configuré : les données et les comptes restent en mémoire (non persistés)."
        );
    }
    println!(
        "Comptes autorisés : {}",
        if state.config.authorized_emails.is_empty() {
            "(aucun)".to_string()
        } else {
            state.config.authorized_emails.join(", ")
        }
    );

    let app = build_router(state);
    let listener = match tokio::net::TcpListener::bind((bind_host.as_str(), port)).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("Erreur au démarrage : {err}");
            std::process::exit(1);
        }
    };
    println!("Projets outliner lancé sur http://localhost:{port}");

    if let Err(err) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        eprintln!("Erreur du serveur : {err}");
        std::process::exit(1);
    }
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    println!("Arrêt du serveur.");
}

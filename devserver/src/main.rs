// Local preview server for the static site, built on axum + tower-http.
// Static file serving (content-types, path-traversal protection, index.html
// fallback) is handled entirely by `ServeDir`/`ServeFile`.
use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() {
    let port: u16 = env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(8000);

    // This binary lives in a `devserver` subfolder alongside the site files,
    // so the repo root is one directory up.
    let root: PathBuf = env::current_dir()
        .unwrap()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| env::current_dir().unwrap());

    let serve_dir = ServeDir::new(&root).fallback(ServeFile::new(root.join("index.html")));
    let app = Router::new().fallback_service(serve_dir);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("failed to bind {addr}: {e}"));

    println!("Serving {} at http://{addr}", root.display());
    println!("Press Ctrl+C to stop.");

    axum::serve(listener, app).await.unwrap();
}

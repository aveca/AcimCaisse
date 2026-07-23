/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
// Active l'isolation cross-origin (COOP/COEP) sur des hebergeurs statiques
// (ex: GitHub Pages) afin que SharedArrayBuffer et le stockage persistant OPFS
// soient disponibles pour drift (SQLite WASM) -> les donnees sont conservees.
// MODIF: desactive sur mobile (reload infini) + max 2 tentatives de reload
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration
                .unregister()
                .then(() => self.clients.matchAll())
                .then((clients) => clients.forEach((client) => client.navigate(client.url)));
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
            return;
        }

        const request = (coepCredentialless && r.mode === "no-cors")
            ? new Request(r, { credentials: "omit" })
            : r;
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy",
                        coepCredentialless ? "credentialless" : "require-corp");
                    if (!coepCredentialless) {
                        newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");
                    }
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => console.error(e))
        );
    });

} else {
    (() => {
        // Desactiver sur mobile - SharedArrayBuffer/OPFS non supporte de toute facon
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            console.log("COOP/COEP Service Worker skipped on mobile");
            return;
        }

        // Max 2 tentatives de reload pour eviter une boucle infinie
        var reloadCount = parseInt(sessionStorage.getItem("coiReloadCount") || "0");
        if (reloadCount >= 2) {
            console.log("COOP/COEP: max reload attempts reached, giving up");
            sessionStorage.removeItem("coiReloadCount");
            return;
        }

        const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
        window.sessionStorage.removeItem("coiReloadedBySelf");
        const coepDegrading = (reloadedBySelf == "coepdegrade");

        const coi = {
            shouldRegister: () => !reloadedBySelf,
            shouldDeregister: () => false,
            coepCredentialless: () => true,
            coepDegrade: () => true,
            doReload: () => {
                sessionStorage.setItem("coiReloadCount", String(reloadCount + 1));
                window.location.reload();
            },
            quiet: false,
            ...window.coi
        };

        const n = navigator;
        const controlling = n.serviceWorker && n.serviceWorker.controller;

        if (controlling) {
            n.serviceWorker.controller.postMessage({
                type: "coepCredentialless",
                value: (coepDegrading || coi.coepCredentialless()),
            });
        }

        if (!window.crossOriginIsolated && !coepDegrading && coi.shouldRegister()) {
            if (!n.serviceWorker) {
                !coi.quiet && console.log("COOP/COEP Service Worker not registered, perhaps due to insecure context.");
                return;
            }

            n.serviceWorker.register(window.document.currentScript.src).then(
                (registration) => {
                    !coi.quiet && console.log("COOP/COEP Service Worker registered", registration.scope);

                    registration.addEventListener("updatefound", () => {
                        !coi.quiet && console.log("Reloading page to make use of updated COOP/COEP Service Worker.");
                        window.sessionStorage.setItem("coiReloadedBySelf", "updatefound");
                        coi.doReload();
                    });

                    if (registration.active && !n.serviceWorker.controller) {
                        !coi.quiet && console.log("Reloading page to make use of COOP/COEP Service Worker.");
                        window.sessionStorage.setItem("coiReloadedBySelf", "notcontrolling");
                        coi.doReload();
                    }
                },
                (err) => {
                    !coi.quiet && console.error("COOP/COEP Service Worker failed to register:", err);
                }
            );
        } else {
            // Isolation OK ou deja tente, reinitialiser le compteur
            sessionStorage.removeItem("coiReloadCount");
        }
    })();
}

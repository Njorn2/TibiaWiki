/* Mapa do Tibia Wiki. Viewer escrito à mão. As imagens vêm de tiles.json e dos PNG Minimap_Color. */
(function (global) {
    var TILE = 256;
    var MAX_ZOOM = 3;
    var MAX_FLOOR = 15;
    var TILE_BASE = "https://cdn.jsdelivr.net/gh/TibiaWikiBR/map-images@main";
    var SDK_URL = "https://cdn.jsdelivr.net/npm/@umanthir/sdk@1.2.0/dist/umanthir.min.js";
    var HOUSE_ICON = "https://www.tibiawiki.com.br/images/7/74/Icon-map-house.png";
    var pageTileBase = null;
    var indexes = {};
    var stamps = {};
    var sdkPromise = null;
    var housesPromise = null;

    function clampZoom(zoom) {
        var value = parseInt(zoom, 10);
        if (isNaN(value) || value < 0) {
            return 0;
        }
        return value > MAX_ZOOM ? MAX_ZOOM : value;
    }

    function scaleOf(zoom) {
        return 1 << clampZoom(zoom);
    }

    function parseCoord(text) {
        var match = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?::\s*(\d+)\s*)?$/.exec(text || "");
        if (!match) {
            return null;
        }
        var z = parseInt(match[3], 10);
        if (z > MAX_FLOOR) {
            return null;
        }
        return {
            x: parseInt(match[1], 10),
            y: parseInt(match[2], 10),
            z: z,
            zoom: clampZoom(match[4] == null ? 1 : match[4])
        };
    }

    function hashOf(position) {
        return position.x + "," + position.y + "," + position.z + ":" + position.zoom;
    }

    function floorLevel(z) {
        return 7 - z;
    }

    function floorShort(z) {
        if (z === 7) {
            return "Térreo";
        }
        var level = floorLevel(z);
        return level > 0 ? "+" + level : "−" + Math.abs(level);
    }

    function floorLong(z) {
        if (z === 7) {
            return "Térreo";
        }
        var level = floorLevel(z);
        return level > 0 ? "Andar +" + level : "Andar −" + Math.abs(level);
    }

    function loadStamp(base) {
        if (document.documentElement.getAttribute("data-tw-map")) {
            return Promise.resolve("");
        }
        if (!stamps[base]) {
            stamps[base] = fetch(base.replace(/\/$/, "") + "/versao.txt", { cache: "no-cache" })
                .then(function (response) {
                    if (!response.ok) {
                        return "";
                    }
                    return response.text();
                })
                .then(function (text) {
                    return String(text || "").trim();
                })
                .catch(function () {
                    delete stamps[base];
                    return "";
                });
        }
        return stamps[base];
    }

    function loadIndex(base) {
        if (!indexes[base]) {
            indexes[base] = fetch(base.replace(/\/$/, "") + "/tiles.json", { cache: "no-cache" })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error("índice");
                    }
                    return response.json();
                })
                .then(function (names) {
                    return new Set(names);
                })
                .catch(function (error) {
                    delete indexes[base];
                    throw error;
                });
        }
        return indexes[base];
    }

    function tileKey(x, y, z) {
        return (Math.floor(x / TILE) * TILE) + "_" + (Math.floor(y / TILE) * TILE) + "_" + z;
    }

    function formatGold(value) {
        var number = Number(value);
        if (!isFinite(number)) {
            return "—";
        }
        return number.toLocaleString("pt-BR") + " gp";
    }

    function wikiPageUrl(name) {
        var aliases = {
            "Warriors' Guildhall": "Warriors Guildhall"
        };
        var title = String(name || "").trim();
        title = aliases[title] || title;
        return "https://www.tibiawiki.com.br/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));
    }

    function loadSdk() {
        if (global.Umanthir) {
            return Promise.resolve(global.Umanthir);
        }
        if (!sdkPromise) {
            sdkPromise = new Promise(function (resolve, reject) {
                var script = document.createElement("script");
                script.src = SDK_URL;
                script.async = true;
                script.onload = function () {
                    if (typeof global.Umanthir === "function") {
                        resolve(global.Umanthir);
                        return;
                    }
                    sdkPromise = null;
                    reject(new Error("sdk"));
                };
                script.onerror = function () {
                    sdkPromise = null;
                    reject(new Error("sdk"));
                };
                document.head.appendChild(script);
            });
        }
        return sdkPromise;
    }

    // A lista do SDK traz nome e aluguel. A porta (house.entrance) não vem nela:
    // baixar as 995 plantas estoura o limite anônimo de 20 pedidos por minuto.
    // houses.json guarda só a porta, tirada desses mesmos JSON.
    function entrancesUrl(base) {
        if (document.documentElement.getAttribute("data-tw-map")) {
            return "houses.json";
        }
        return base.replace(/\/$/, "") + "/houses.json";
    }

    function loadHouses(base) {
        if (!housesPromise) {
            housesPromise = Promise.all([
                loadSdk().then(function (Umanthir) {
                    return new Umanthir({ maxRetries: 0, logLevel: "off" }).wiki.houses();
                }),
                fetch(entrancesUrl(base), { cache: "no-cache" }).then(function (response) {
                    if (!response.ok) {
                        throw new Error("entradas");
                    }
                    return response.json();
                })
            ]).then(function (parts) {
                var list = parts[0] && parts[0].houses ? parts[0].houses : [];
                var entrances = parts[1] || {};
                var houses = [];
                list.forEach(function (house) {
                    var at = entrances[house.slug];
                    if (!at || at.length < 3) {
                        return;
                    }
                    var z = at[2];
                    if (z < 0 || z > MAX_FLOOR) {
                        return;
                    }
                    houses.push({
                        slug: house.slug,
                        name: house.name,
                        rent: house.rent,
                        x: at[0],
                        y: at[1],
                        z: z,
                        url: wikiPageUrl(house.name)
                    });
                });
                return houses;
            }).catch(function (error) {
                housesPromise = null;
                throw error;
            });
        }
        return housesPromise;
    }

    function mountMap(container, options) {
        var base = (options.tileBase || pageTileBase || TILE_BASE).replace(/\/$/, "");
        var state = {
            centerX: options.x,
            centerY: options.y,
            z: options.z,
            zoom: clampZoom(options.zoom),
            markX: options.x,
            markY: options.y,
            lockMark: options.lockMark === true,
            syncHash: options.syncHash === true,
            index: null,
            version: "",
            failed: false,
            drag: null,
            tiles: new Map(),
            houses: null,
            houseNodes: new Map(),
            houseTicket: 0,
            houseError: false,
            frame: 0
        };

        container.replaceChildren();
        var root = document.createElement("div");
        root.className = "tw-map";
        root.setAttribute("role", "region");
        root.setAttribute("aria-label", "Mapa do Tibia");
        root.innerHTML = "<div class=\"tw-map-stage\" tabindex=\"0\" aria-label=\"Mapa. Arraste para mover. Clique para marcar um sqm. Page Up e Page Down trocam o andar.\"></div>" +
            "<div class=\"tw-map-floors\" role=\"group\" aria-label=\"Andar\">" +
            "<button type=\"button\" class=\"tw-map-up\" aria-label=\"Subir um andar\">▲</button>" +
            "<span class=\"tw-map-floor\" aria-live=\"polite\"></span>" +
            "<button type=\"button\" class=\"tw-map-down\" aria-label=\"Descer um andar\">▼</button>" +
            "</div>" +
            "<label class=\"tw-map-layers\"><input type=\"checkbox\" class=\"tw-map-houses-toggle\"> Houses</label>" +
            "<div class=\"tw-map-tools\" role=\"group\" aria-label=\"Zoom\">" +
            "<button type=\"button\" class=\"tw-map-zoom-in\" aria-label=\"Aumentar zoom\">+</button>" +
            "<span class=\"tw-map-zoom\"></span>" +
            "<button type=\"button\" class=\"tw-map-zoom-out\" aria-label=\"Diminuir zoom\">−</button>" +
            "<button type=\"button\" class=\"tw-map-center\" aria-label=\"Centralizar no marcador\">◎</button>" +
            "</div>" +
            "<div class=\"tw-map-coord\">" +
            "<span><b>X</b><span class=\"tw-map-x\"></span></span>" +
            "<span><b>Y</b><span class=\"tw-map-y\"></span></span>" +
            "<span><b>Z</b><span class=\"tw-map-z\"></span></span>" +
            "</div>" +
            "<p class=\"tw-map-hint\">Arraste para mover · clique marca o sqm</p>";
        container.appendChild(root);
        var stageLabel = root.querySelector(".tw-map-stage");
        var hintLabel = root.querySelector(".tw-map-hint");
        if (state.lockMark) {
            stageLabel.setAttribute("aria-label", "Mapa. Arraste para mover. Page Up e Page Down trocam o andar.");
            hintLabel.textContent = "Arraste para mover";
        }
        if (container.closest(".map_frame")) {
            root.classList.add("has-close");
            var closeButton = document.createElement("button");
            closeButton.type = "button";
            closeButton.className = "tw-map-close";
            closeButton.setAttribute("aria-label", "Fechar mapa");
            closeButton.textContent = "×";
            closeButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                var show = container.closest(".map_show");
                if (show) {
                    closePopup(show);
                }
            });
            root.appendChild(closeButton);
        }

        var floorGroup = root.querySelector(".tw-map-floors");
        var floorNode = root.querySelector(".tw-map-floor");
        var xNode = root.querySelector(".tw-map-x");
        var yNode = root.querySelector(".tw-map-y");
        var zNode = root.querySelector(".tw-map-z");
        var zoomNode = root.querySelector(".tw-map-zoom");
        var upButton = root.querySelector(".tw-map-up");
        var downButton = root.querySelector(".tw-map-down");
        var zoomOutButton = root.querySelector(".tw-map-zoom-out");
        var zoomInButton = root.querySelector(".tw-map-zoom-in");
        var centerButton = root.querySelector(".tw-map-center");
        var hint = root.querySelector(".tw-map-hint");
        var housesToggle = root.querySelector(".tw-map-houses-toggle");
        var housesLabel = root.querySelector(".tw-map-layers");
        var stage = root.querySelector(".tw-map-stage");
        var world = document.createElement("div");
        world.className = "tw-map-world";
        var pin = document.createElement("div");
        pin.className = "tw-map-pin";
        pin.setAttribute("aria-hidden", "true");
        var hover = document.createElement("div");
        hover.className = "tw-map-hover";
        hover.setAttribute("aria-hidden", "true");
        var marker = document.createElement("div");
        marker.className = "tw-map-marker";
        marker.setAttribute("aria-hidden", "true");
        var status = document.createElement("p");
        status.className = "tw-map-status";
        status.setAttribute("role", "status");
        world.appendChild(pin);
        world.appendChild(hover);
        var housesLayer = document.createElement("div");
        housesLayer.className = "tw-map-houses";
        housesLayer.hidden = true;
        stage.appendChild(world);
        stage.appendChild(marker);
        stage.appendChild(status);
        root.appendChild(housesLayer);

        function writeHash() {
            if (!state.syncHash) {
                return;
            }
            var next = "#" + hashOf({
                x: state.markX,
                y: state.markY,
                z: state.z,
                zoom: state.zoom
            });
            if (location.hash !== next) {
                history.replaceState(history.state, "", next);
            }
        }

        function place(clientX, clientY) {
            var rect = stage.getBoundingClientRect();
            var scale = scaleOf(state.zoom);
            return {
                x: state.centerX + (clientX - rect.left - rect.width / 2) / scale,
                y: state.centerY + (clientY - rect.top - rect.height / 2) / scale
            };
        }

        function render() {
            var rect = stage.getBoundingClientRect();
            var scale = scaleOf(state.zoom);
            var panX = Math.round(rect.width / 2 - state.centerX * scale);
            var panY = Math.round(rect.height / 2 - state.centerY * scale);
            world.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + scale + ")";
            marker.style.left = (rect.width / 2 + (state.markX + 0.5 - state.centerX) * scale) + "px";
            marker.style.top = (rect.height / 2 + (state.markY + 0.5 - state.centerY) * scale) + "px";
            pin.style.left = state.markX + "px";
            pin.style.top = state.markY + "px";
            floorNode.textContent = floorShort(state.z);
            floorGroup.setAttribute("aria-label", floorLong(state.z));
            xNode.textContent = String(state.markX);
            yNode.textContent = String(state.markY);
            zNode.textContent = String(state.z);
            zoomNode.textContent = (scale * 100) + "%";
            upButton.disabled = state.z <= 0;
            downButton.disabled = state.z >= MAX_FLOOR;
            zoomOutButton.disabled = state.zoom <= 0;
            zoomInButton.disabled = state.zoom >= MAX_ZOOM;
            syncHouses(rect, scale);

            if (state.failed) {
                status.hidden = false;
                status.textContent = "Não foi possível carregar o índice do mapa.";
                return;
            }
            if (!state.index) {
                status.hidden = false;
                status.textContent = "Carregando o mapa…";
                return;
            }
            var key = tileKey(state.markX, state.markY, state.z);
            var covered = state.index.has(key);
            if (state.houseError) {
                status.hidden = false;
                status.textContent = "Não foi possível carregar as casas.";
            } else {
                status.hidden = covered;
                status.textContent = covered ? "" : "Esta região ainda não está no mapa.";
            }
            syncTiles(rect, scale);
        }

        function houseLink(house) {
            var link = document.createElement("a");
            link.className = "tw-map-house";
            link.href = house.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.draggable = false;
            link.setAttribute("aria-label", house.name + ", " + formatGold(house.rent));
            var icon = document.createElement("img");
            icon.src = HOUSE_ICON;
            icon.alt = "";
            icon.width = 32;
            icon.height = 32;
            icon.draggable = false;
            icon.addEventListener("error", function () {
                if (icon.getAttribute("data-fallback") === "true" || !document.documentElement.getAttribute("data-tw-map")) {
                    return;
                }
                icon.setAttribute("data-fallback", "true");
                icon.src = "icon-map-house.png";
            });
            var tip = document.createElement("span");
            tip.className = "tw-map-house-tip";
            var tipName = document.createElement("b");
            tipName.textContent = house.name;
            var tipPrice = document.createElement("span");
            tipPrice.textContent = formatGold(house.rent);
            tip.appendChild(tipName);
            tip.appendChild(tipPrice);
            link.appendChild(icon);
            link.appendChild(tip);
            return link;
        }

        function syncHouses(rect, scale) {
            if (!housesToggle.checked || !state.houses) {
                housesLayer.hidden = true;
                state.houseNodes.forEach(function (node) { node.remove(); });
                state.houseNodes.clear();
                return;
            }
            housesLayer.hidden = false;
            var pad = 24;
            var left = state.centerX - (rect.width / 2 + pad) / scale;
            var top = state.centerY - (rect.height / 2 + pad) / scale;
            var right = state.centerX + (rect.width / 2 + pad) / scale;
            var bottom = state.centerY + (rect.height / 2 + pad) / scale;
            var wanted = new Set();
            state.houses.forEach(function (house) {
                if (house.z !== state.z || house.x < left || house.x > right || house.y < top || house.y > bottom) {
                    return;
                }
                wanted.add(house.slug);
                var node = state.houseNodes.get(house.slug);
                if (!node) {
                    node = houseLink(house);
                    housesLayer.appendChild(node);
                    state.houseNodes.set(house.slug, node);
                }
                var screenX = rect.width / 2 + (house.x + 0.5 - state.centerX) * scale;
                var screenY = rect.height / 2 + (house.y + 0.5 - state.centerY) * scale;
                node.style.left = screenX + "px";
                node.style.top = screenY + "px";
                node.classList.toggle("is-below", screenY < 72);
            });
            state.houseNodes.forEach(function (node, slug) {
                if (!wanted.has(slug)) {
                    node.remove();
                    state.houseNodes.delete(slug);
                }
            });
        }

        function syncTiles(rect, scale) {
            var left = state.centerX - rect.width / 2 / scale;
            var top = state.centerY - rect.height / 2 / scale;
            var right = state.centerX + rect.width / 2 / scale;
            var bottom = state.centerY + rect.height / 2 / scale;
            var wanted = new Set();
            var x0 = Math.floor(left / TILE) * TILE;
            var y0 = Math.floor(top / TILE) * TILE;
            var x1 = Math.floor(right / TILE) * TILE;
            var y1 = Math.floor(bottom / TILE) * TILE;
            var x;
            var y;
            for (x = x0; x <= x1; x += TILE) {
                for (y = y0; y <= y1; y += TILE) {
                    var name = x + "_" + y + "_" + state.z;
                    if (!state.index.has(name)) {
                        continue;
                    }
                    wanted.add(name);
                    if (state.tiles.has(name)) {
                        continue;
                    }
                    var image = document.createElement("img");
                    image.className = "tw-map-tile";
                    image.alt = "";
                    image.draggable = false;
                    image.style.left = x + "px";
                    image.style.top = y + "px";
                    image.src = base + "/Minimap_Color_" + x + "_" + y + "_" + state.z + ".png" + (state.version ? "?v=" + encodeURIComponent(state.version) : "");
                    world.appendChild(image);
                    state.tiles.set(name, image);
                }
            }
            state.tiles.forEach(function (image, name) {
                if (!wanted.has(name)) {
                    image.remove();
                    state.tiles.delete(name);
                }
            });
        }

        function schedule() {
            if (state.frame) {
                return;
            }
            state.frame = requestAnimationFrame(function () {
                state.frame = 0;
                render();
            });
        }

        function setFloor(z) {
            state.z = Math.max(0, Math.min(MAX_FLOOR, z));
            state.tiles.forEach(function (image) { image.remove(); });
            state.tiles.clear();
            writeHash();
            schedule();
        }

        function setZoom(zoom, clientX, clientY) {
            var next = clampZoom(zoom);
            if (clientX != null && stage.getBoundingClientRect().width) {
                var before = place(clientX, clientY);
                state.zoom = next;
                var afterScale = scaleOf(state.zoom);
                var rect = stage.getBoundingClientRect();
                state.centerX = before.x - (clientX - rect.left - rect.width / 2) / afterScale;
                state.centerY = before.y - (clientY - rect.top - rect.height / 2) / afterScale;
            } else {
                state.zoom = next;
            }
            writeHash();
            schedule();
        }

        upButton.addEventListener("click", function () { setFloor(state.z - 1); });
        downButton.addEventListener("click", function () { setFloor(state.z + 1); });
        zoomOutButton.addEventListener("click", function () { setZoom(state.zoom - 1); });
        zoomInButton.addEventListener("click", function () { setZoom(state.zoom + 1); });
        centerButton.addEventListener("click", function () {
            state.centerX = state.markX + 0.5;
            state.centerY = state.markY + 0.5;
            schedule();
        });
        housesToggle.addEventListener("change", function () {
            state.houseTicket += 1;
            var ticket = state.houseTicket;
            state.houseError = false;
            if (!housesToggle.checked) {
                schedule();
                return;
            }
            housesLabel.setAttribute("aria-busy", "true");
            loadHouses(base).then(function (houses) {
                if (ticket !== state.houseTicket) {
                    return;
                }
                housesLabel.removeAttribute("aria-busy");
                state.houses = houses;
                schedule();
            }).catch(function () {
                if (ticket !== state.houseTicket) {
                    return;
                }
                housesLabel.removeAttribute("aria-busy");
                housesToggle.checked = false;
                state.houseError = true;
                schedule();
            });
        });

        function dismissHint() {
            hint.classList.add("is-dismissed");
        }
        global.setTimeout(dismissHint, 5000);

        function showHover(event) {
            var point = place(event.clientX, event.clientY);
            hover.style.display = "block";
            hover.style.left = Math.floor(point.x) + "px";
            hover.style.top = Math.floor(point.y) + "px";
        }

        stage.addEventListener("pointerdown", function (event) {
            if (event.button !== 0) {
                return;
            }
            state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
            stage.classList.add("is-dragging");
            stage.setPointerCapture(event.pointerId);
        });
        stage.addEventListener("pointermove", function (event) {
            if (!state.drag || state.drag.id !== event.pointerId) {
                return;
            }
            var scale = scaleOf(state.zoom);
            var dx = event.clientX - state.drag.x;
            var dy = event.clientY - state.drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) {
                state.drag.moved = true;
                dismissHint();
            }
            hover.style.display = "none";
            state.drag.x = event.clientX;
            state.drag.y = event.clientY;
            state.centerX -= dx / scale;
            state.centerY -= dy / scale;
            schedule();
        });
        function endDrag(event) {
            if (!state.drag || state.drag.id !== event.pointerId) {
                return;
            }
            var moved = state.drag.moved;
            state.drag = null;
            stage.classList.remove("is-dragging");
            showHover(event);
            if (!moved && !state.lockMark) {
                var point = place(event.clientX, event.clientY);
                state.markX = Math.floor(point.x);
                state.markY = Math.floor(point.y);
                writeHash();
                schedule();
            }
        }
        stage.addEventListener("pointerup", endDrag);
        stage.addEventListener("pointermove", function (event) {
            if (state.drag) {
                return;
            }
            showHover(event);
        });
        stage.addEventListener("pointerleave", function () {
            hover.style.display = "none";
        });
        stage.addEventListener("pointercancel", function (event) {
            if (state.drag && state.drag.id === event.pointerId) {
                state.drag = null;
                stage.classList.remove("is-dragging");
            }
        });
        stage.addEventListener("wheel", function (event) {
            event.preventDefault();
            setZoom(state.zoom + (event.deltaY > 0 ? -1 : 1), event.clientX, event.clientY);
        }, { passive: false });
        stage.addEventListener("keydown", function (event) {
            var step = 128;
            if (event.key === "ArrowLeft") {
                state.centerX -= step;
            } else if (event.key === "ArrowRight") {
                state.centerX += step;
            } else if (event.key === "ArrowUp") {
                state.centerY -= step;
            } else if (event.key === "ArrowDown") {
                state.centerY += step;
            } else if (event.key === "PageUp") {
                setFloor(state.z - 1);
                event.preventDefault();
                return;
            } else if (event.key === "PageDown") {
                setFloor(state.z + 1);
                event.preventDefault();
                return;
            } else if (event.key === "+" || event.key === "=") {
                setZoom(state.zoom + 1);
                event.preventDefault();
                return;
            } else if (event.key === "-") {
                setZoom(state.zoom - 1);
                event.preventDefault();
                return;
            } else {
                return;
            }
            event.preventDefault();
            schedule();
        });
        stage.addEventListener("dblclick", function (event) {
            event.preventDefault();
            if (state.lockMark) {
                return;
            }
            var point = place(event.clientX, event.clientY);
            state.centerX = point.x;
            state.centerY = point.y;
            schedule();
        });

        if (typeof ResizeObserver === "function") {
            var observer = new ResizeObserver(schedule);
            observer.observe(stage);
        }
        if (state.syncHash) {
            global.addEventListener("hashchange", function () {
                var next = parseCoord(location.hash.replace(/^#/, ""));
                if (!next) {
                    return;
                }
                state.centerX = next.x;
                state.centerY = next.y;
                state.markX = next.x;
                state.markY = next.y;
                state.z = next.z;
                state.zoom = next.zoom;
                state.tiles.forEach(function (image) { image.remove(); });
                state.tiles.clear();
                schedule();
            });
        }

        render();
        Promise.all([loadIndex(base), loadStamp(base)]).then(function (parts) {
            state.index = parts[0];
            state.version = parts[1];
            schedule();
        }).catch(function () {
            state.failed = true;
            schedule();
        });
        return root;
    }

    function logoLink(position) {
        var link = document.createElement("a");
        link.className = "map_logo";
        link.href = "https://www.tibiawiki.com.br/wiki/Mapa#" + hashOf(position);
        link.target = "_blank";
        link.rel = "noopener";
        link.title = "Ver no mapa do Tibia Wiki";
        link.setAttribute("aria-label", "Ver no mapa do Tibia Wiki");
        return link;
    }

    function ensureLogo(show, position) {
        var box = show.querySelector(".map_logobox");
        if (!box || box.querySelector(".map_logo")) {
            return;
        }
        box.appendChild(logoLink(position));
    }

    function closePopup(show) {
        var frame = show.querySelector(".map_frame");
        var overlay = show.querySelector(".map_overlay");
        var box = show.querySelector(".map_box");
        if (frame) {
            frame.style.display = "none";
        }
        if (overlay) {
            overlay.style.display = "none";
        }
        if (box) {
            box.replaceChildren();
        }
    }

    function openPopup(show) {
        document.querySelectorAll(".map_show").forEach(function (other) {
            if (other !== show) {
                closePopup(other);
            }
        });
        var frame = show.querySelector(".map_frame");
        var overlay = show.querySelector(".map_overlay");
        var box = show.querySelector(".map_box");
        var coord = show.querySelector(".map_frame_coord");
        if (!frame || !box || !coord) {
            return;
        }
        var position = parseCoord(coord.textContent);
        frame.style.display = "block";
        if (overlay) {
            overlay.style.display = "block";
        }
        box.style.width = "100%";
        box.style.height = "100%";
        box.replaceChildren();
        ensureLogo(show, position || { x: 0, y: 0, z: 7, zoom: 1 });
        if (!position) {
            box.textContent = "Coordenada inválida.";
            return;
        }
        mountMap(box, {
            x: position.x,
            y: position.y,
            z: position.z,
            zoom: position.zoom,
            lockMark: true
        });
    }

    function mountInline(selector, coordSelector, boxSelector, height) {
        document.querySelectorAll(selector).forEach(function (host) {
            var coord = host.querySelector(coordSelector);
            var box = host.querySelector(boxSelector);
            if (!coord || !box || box.getAttribute("data-map-ready") === "true") {
                return;
            }
            var position = parseCoord(coord.textContent);
            box.style.height = height + "px";
            box.setAttribute("data-map-ready", "true");
            ensureLogo(host, position || { x: 0, y: 0, z: 7, zoom: 1 });
            if (!position) {
                box.textContent = "Coordenada inválida.";
                return;
            }
            mountMap(box, position);
        });
    }

    function boot(tileBase) {
        if (global.__tibiaWikiMapBooted) {
            return;
        }
        global.__tibiaWikiMapBooted = true;
        if (tileBase) {
            pageTileBase = tileBase;
        }
        document.querySelectorAll(".map_wiki").forEach(function (host) {
            if (!host.style.height && host.clientHeight < 200) {
                host.style.height = "640px";
            }
            var position = parseCoord(location.hash.replace(/^#/, "")) || { x: 32368, y: 32198, z: 7, zoom: 1 };
            mountMap(host, {
                x: position.x,
                y: position.y,
                z: position.z,
                zoom: position.zoom,
                syncHash: true
            });
        });
        mountInline(".map_hunt", ".map_hunt_coord", ".map_hunt_box", 310);
        mountInline(".map_hunt_geo", ".map_hunt_coord_geo", ".map_hunt_box_geo", 430);
        document.addEventListener("click", function (event) {
            var overlay = event.target.closest(".map_overlay");
            if (overlay) {
                var parent = overlay.closest(".map_show");
                if (parent) {
                    closePopup(parent);
                }
                event.preventDefault();
                return;
            }
            if (event.target.closest(".map_frame, .map_logobox")) {
                return;
            }
            var show = event.target.closest(".map_show");
            if (!show) {
                return;
            }
            var frame = show.querySelector(".map_frame");
            if (frame && global.getComputedStyle(frame).display !== "none") {
                return;
            }
            event.preventDefault();
            openPopup(show);
        });
    }

    function start() {
        var manual = document.documentElement.getAttribute("data-tw-map");
        boot(manual || undefined);
    }

    global.TibiaWikiMap = {
        mountMap: mountMap,
        parseCoord: parseCoord,
        boot: boot
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
}(window));

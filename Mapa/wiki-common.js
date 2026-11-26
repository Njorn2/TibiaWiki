/* Substituir o bloco do mapa no MediaWiki:Common.js por este carregador.
   Copiar mapa.js para MediaWiki:Common.js/mapa.js e mapa.css para MediaWiki:Common.css/mapa.css. */
(function () {
    function start() {
        if (!document.querySelector(".map_wiki, .map_show, .map_hunt, .map_hunt_geo")) {
            return;
        }
        if (!document.querySelector("link[data-tibiawiki-map]")) {
            var css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = "/index.php?title=MediaWiki:Common.css/mapa.css&action=raw&ctype=text/css&v=20261125d";
            css.setAttribute("data-tibiawiki-map", "true");
            document.head.appendChild(css);
        }
        if (document.querySelector("script[data-tibiawiki-map]")) {
            return;
        }
        var script = document.createElement("script");
        script.src = "/index.php?title=MediaWiki:Common.js/mapa.js&action=raw&ctype=text/javascript&v=20261125d";
        script.setAttribute("data-tibiawiki-map", "true");
        document.head.appendChild(script);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
}());

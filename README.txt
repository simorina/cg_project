all'interno di questo progetto vengono richiamate tramite API le librerie:
    - m4.js
    - webgl-utils.js

Perchè: il motivo di tale scelta ricade sul fatto di non doverle avere forzatamente in locale.
Esse verranno eseguite automaticamente nel momento in cui si avvia LiveServer, inviando un richiesta di GET ottenendo le libirerire pienamente funzionanti.

Esse vengono richiamate in index.html

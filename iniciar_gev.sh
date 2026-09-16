#!/bin/bash
# Arranca el dev server de God's Eye View (Ojo de Dios) para que el iframe
# de Jarvis siempre tenga algo en http://127.0.0.1:4173. 14 sep 2026.
export PATH="/Users/luissantiagogonzalezcernuda/.nvm/versions/node/v24.18.0/bin:$PATH"
cd /Users/luissantiagogonzalezcernuda/sitios/gods-eye-view || exit 1
exec npm run dev

#!/usr/bin/env zsh
set -euo pipefail

# Dossier où se trouve ce script
SCRIPT_DIR="$(cd -- "$(dirname -- "${0:A}")" && pwd)"

# Ici ton script est dans .../apps/mobile
# donc la racine du repo est deux niveaux au-dessus
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Chemins par défaut (tu peux toujours les overrider en arguments)
DOSSIER_SOURCE="${1:-"$REPO_ROOT/apps/mobile"}"
FICHIER_SORTIE="${2:-"$REPO_ROOT/dump_mobile.txt"}"

echo "Analyse du dossier Mobile en cours..."
echo "Source : $DOSSIER_SOURCE"
echo "Sortie : $FICHIER_SORTIE"

if [[ ! -d "$DOSSIER_SOURCE" ]]; then
  echo "Erreur: le dossier source n'existe pas : $DOSSIER_SOURCE" >&2
  exit 1
fi

: > "$FICHIER_SORTIE"

find "$DOSSIER_SOURCE" \
  \( -type d \( -name node_modules -o -name .expo -o -name .vscode -o -name assets \) -prune \) -o \
  \( -type f \( -name "*.ts" -o -name "*.tsx" \) -print \) \
| sort \
| while IFS= read -r fichier; do
    {
      echo
      echo "=================================================================="
      echo "FICHIER : $fichier"
      echo "=================================================================="
      if ! cat "$fichier"; then
        echo "[ERREUR LECTURE] $fichier"
      fi
    } >> "$FICHIER_SORTIE"
  done

echo "Terminé ! Le fichier se trouve ici : $FICHIER_SORTIE"

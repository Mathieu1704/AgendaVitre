#!/usr/bin/env zsh
set -euo pipefail

# Dossier où se trouve ce script
SCRIPT_DIR="$(cd -- "$(dirname -- "${0:A}")" && pwd)"

# Ton script est dans .../apps/backend
# donc la racine du repo est deux niveaux au-dessus
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Chemins par défaut (overridable via arguments)
DOSSIER_SOURCE="${1:-"$REPO_ROOT/apps/backend"}"
FICHIER_SORTIE="${2:-"$REPO_ROOT/dump_backend.txt"}"

echo "Analyse du dossier Backend en cours..."
echo "Source : $DOSSIER_SOURCE"
echo "Sortie : $FICHIER_SORTIE"

if [[ ! -d "$DOSSIER_SOURCE" ]]; then
  echo "Erreur: le dossier source n'existe pas : $DOSSIER_SOURCE" >&2
  exit 1
fi

# Crée le dossier parent du fichier de sortie si besoin + overwrite
mkdir -p "$(dirname "$FICHIER_SORTIE")"
: > "$FICHIER_SORTIE"

# Dump uniquement des .py en excluant les dossiers inutiles
find "$DOSSIER_SOURCE" \
  \( -type d \( \
      -name venv -o -name .venv -o -name __pycache__ -o -name .git -o \
      -name .pytest_cache -o -name .mypy_cache -o -name .ruff_cache -o \
      -name build -o -name dist \
    \) -prune \) -o \
  \( -type f -name "*.py" -print \) \
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
sleep 3

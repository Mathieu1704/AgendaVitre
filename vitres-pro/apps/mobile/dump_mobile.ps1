# Configuration
$dossierSource = "C:\Users\Mathieu\Desktop\AgendraProVitre\vitres-pro\apps\mobile"
$fichierSortie = "C:\Users\Mathieu\Desktop\AgendraProVitre\dump_mobile.txt"

# Création/Nettoyage du fichier de sortie (UTF-8)
"" | Out-File -FilePath $fichierSortie -Encoding utf8

Write-Host "Analyse du dossier Mobile en cours..." -ForegroundColor Cyan

# Dossiers à exclure
$excludePatterns = @(
  "\\node_modules\\",
  "\\.expo\\",
  "\\.vscode\\",
  "\\assets\\"
)

# Récupérer UNIQUEMENT les fichiers .ts/.tsx
$fichiers = Get-ChildItem -LiteralPath $dossierSource -Recurse -File |
  Where-Object { $_.Extension -in @(".ts", ".tsx") } |
  Where-Object {
    $full = $_.FullName
    -not ($excludePatterns | Where-Object { $full -match $_ })
  }

foreach ($fichier in $fichiers) {
  $header = "`r`n==================================================================`r`n" +
            "FICHIER : $($fichier.FullName)`r`n" +
            "==================================================================`r`n"

  Add-Content -Path $fichierSortie -Value $header -Encoding utf8

  # Lit le contenu, ignore proprement les erreurs (fichier verrouillé, etc.)
  try {
    Get-Content -LiteralPath $fichier.FullName -Raw -ErrorAction Stop |
      Add-Content -Path $fichierSortie -Encoding utf8
  }
  catch {
    Add-Content -Path $fichierSortie -Value "[ERREUR LECTURE] $($fichier.FullName) : $($_.Exception.Message)`r`n" -Encoding utf8
  }
}

Write-Host "Terminé ! Le fichier se trouve ici : $fichierSortie" -ForegroundColor Green

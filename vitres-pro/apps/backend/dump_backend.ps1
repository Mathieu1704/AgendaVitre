# Configuration
$dossierSource = "C:\Users\Mathieu\Desktop\AgendraProVitre\vitres-pro\apps\backend"
$fichierSortie = "C:\Users\Mathieu\Desktop\AgendraProVitre\dump_backend.txt"

# Création/Nettoyage du fichier de sortie (UTF-8)
"" | Out-File -FilePath $fichierSortie -Encoding utf8

Write-Host "Analyse du dossier Backend en cours..." -ForegroundColor Cyan

# Dossiers à exclure (patterns regex)
$excludePatterns = @(
  "\\.venv\\",
  "\\__pycache__\\",
  "\\.git\\",
  "\\.pytest_cache\\",
  "\\.mypy_cache\\",
  "\\.ruff_cache\\",
  "\\build\\",
  "\\dist\\"
)

# Récupérer UNIQUEMENT les fichiers .py
$fichiers = Get-ChildItem -LiteralPath $dossierSource -Recurse -File |
  Where-Object { $_.Extension -eq ".py" } |
  Where-Object {
    $full = $_.FullName
    -not ($excludePatterns | Where-Object { $full -match $_ })
  }

foreach ($fichier in $fichiers) {
  $header = "`r`n==================================================================`r`n" +
            "FICHIER : $($fichier.FullName)`r`n" +
            "==================================================================`r`n"

  Add-Content -Path $fichierSortie -Value $header -Encoding utf8

  try {
    Get-Content -LiteralPath $fichier.FullName -Raw -ErrorAction Stop |
      Add-Content -Path $fichierSortie -Encoding utf8
  }
  catch {
    Add-Content -Path $fichierSortie -Value "[ERREUR LECTURE] $($fichier.FullName) : $($_.Exception.Message)`r`n" -Encoding utf8
  }
}

Write-Host "Terminé ! Le fichier se trouve ici : $fichierSortie" -ForegroundColor Green
Start-Sleep -Seconds 3

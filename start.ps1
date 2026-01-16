Write-Host "🚀 Lancement de LVM Agenda..." -ForegroundColor Green

# 1. Lancer Supabase (On attend qu'il soit prêt)
Write-Host "1. Démarrage de Supabase..." -ForegroundColor Cyan
npx supabase start
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erreur lors du démarrage de Supabase. Vérifie que Docker tourne."
    exit
}

# 2. Lancer le Backend (Nouvelle fenêtre)
Write-Host "2. Lancement du Backend (FastAPI)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\backend; .\.venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000"

# 3. Lancer le Mobile (Nouvelle fenêtre)
Write-Host "3. Lancement du Mobile (Expo)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\mobile; npx expo start --clear"

Write-Host "✅ Tout est lancé ! Bon code !" -ForegroundColor Green
"""
Migration : sous-zones géographiques.
1. Normalise clients.city (fusions validées)
2. Crée les tables sub_zones + city_sub_zones
3. Ajoute sub_zone sur clients + interventions
4. Backfille sub_zone

Lance depuis apps/backend/ avec : python scripts/migrate_sub_zones.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import engine
from sqlalchemy import text

# --- Fusions de noms de villes (normalisées apostrophes → ' droite) ---
CITY_MERGES = {
    'Bassily': 'Bassilly',
    "Bois d'Haine": "Bois-d'Haine",
    'Bois de Lessines': 'Bois-de-Lessines',
    'Ecaussinnes': 'Écaussinnes',
    'Ellezelle': 'Ellezelles',
    'Le Rœulx': 'Le Roeulx',
    'Marche-lez-Ecaussinnes': 'Marche-lez-Écaussinnes',
    'Petit Enghien': 'Petit-Enghien',
    'Petit Roeulx Lez Braine': 'Petit-Roeulx-lez-Braine',
    'Petit Roeulx-lez-Braine': 'Petit-Roeulx-lez-Braine',
    'CH-N-D Louvignies': 'Chaussée-Notre-Dame-Louvignies',
    'Chaussée-Notre-Dame-de-Louvignies': 'Chaussée-Notre-Dame-Louvignies',
    'BLC': 'Braine-le-Comte',
    'Manage-lez-Ecaussinnes': 'Marche-lez-Écaussinnes',
    'Virginal': 'Virginal-Samme',
    'Virginal / Hennuyères': 'Virginal-Samme',
    'Braine-le-Comte (Virginal/Hennuyères)': 'Braine-le-Comte',
    'Libramont': 'Libramont-Chevigny',
    'Bierghes (Rebecq)': 'Bierghes',
    'Noirefontaine': 'Noirfontaine',
    'Barvaux': 'Barvaux-sur-Ourthe',
    'Auby': 'Auby-sur-Semois',
    'Saintes/Tubize': 'Saintes',
    'Ghoy (Lessines)': 'Ghoy',
    'Thieusies (Naast)': 'Thieusies',
    # apostrophes courbes → droites
    'Braine-l\u2019Alleud': "Braine-l'Alleud",
}

# --- Définition des 19 sous-zones ---
SUB_ZONES = [
    # Hainaut
    {"code": "HAINAUT_SOIGNIES_ECAUSSINNES", "label": "Soignies / Écaussinnes", "parent_zone": "hainaut", "position": 1},
    {"code": "HAINAUT_BRAINE_TUBIZE",         "label": "Braine / Tubize",         "parent_zone": "hainaut", "position": 2},
    {"code": "HAINAUT_ENGHIEN_SILLY",          "label": "Enghien / Silly",          "parent_zone": "hainaut", "position": 3},
    {"code": "HAINAUT_ATH_LESSINES",           "label": "Ath / Lessines",           "parent_zone": "hainaut", "position": 4},
    {"code": "HAINAUT_MONS_JURBISE",           "label": "Mons / Jurbise",           "parent_zone": "hainaut", "position": 5},
    {"code": "HAINAUT_OUEST_BORINAGE",         "label": "Ouest / Borinage",         "parent_zone": "hainaut", "position": 6},
    {"code": "HAINAUT_CENTRE_LALOUVIERE",      "label": "Centre / La Louvière",     "parent_zone": "hainaut", "position": 7},
    {"code": "HAINAUT_CHARLEROI_SUD",          "label": "Charleroi / Sud",          "parent_zone": "hainaut", "position": 8},
    {"code": "HAINAUT_BRABANT_BRUXELLES",      "label": "Brabant / Bruxelles",      "parent_zone": "hainaut", "position": 9},
    # Ardennes
    {"code": "ARDENNES_BERTRIX_BOUILLON",       "label": "Bertrix / Bouillon",       "parent_zone": "ardennes", "position": 1},
    {"code": "ARDENNES_SEMOIS_VRESSE_GEDINNE",  "label": "Semois / Vresse / Gedinne","parent_zone": "ardennes", "position": 2},
    {"code": "ARDENNES_NEUFCHATEAU_LIBRAMONT",  "label": "Neufchâteau / Libramont",  "parent_zone": "ardennes", "position": 3},
    {"code": "ARDENNES_SAINTHUBERT_LIBIN",      "label": "Saint-Hubert / Libin",     "parent_zone": "ardennes", "position": 4},
    {"code": "ARDENNES_BASTOGNE",               "label": "Bastogne",                 "parent_zone": "ardennes", "position": 5},
    {"code": "ARDENNES_GAUME_OUEST",            "label": "Gaume Ouest",              "parent_zone": "ardennes", "position": 6},
    {"code": "ARDENNES_GAUME_EST_ARLON",        "label": "Gaume Est / Arlon",        "parent_zone": "ardennes", "position": 7},
    {"code": "ARDENNES_FAMENNE_MARCHE",         "label": "Famenne / Marche",         "parent_zone": "ardennes", "position": 8},
    {"code": "ARDENNES_NAMUR_MEUSE",            "label": "Namur / Meuse",            "parent_zone": "ardennes", "position": 9},
    {"code": "ARDENNES_EST_OUTLIERS",           "label": "Est (outliers)",           "parent_zone": "ardennes", "position": 10},
]

# --- Mapping ville → code sous-zone ---
CITY_ZONE_MAP = {
    # HAINAUT_SOIGNIES_ECAUSSINNES
    "Écaussinnes": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Soignies": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Naast": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Horrues": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Neufvilles": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Thieusies": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Gottignies": "HAINAUT_SOIGNIES_ECAUSSINNES",
    "Marche-lez-Écaussinnes": "HAINAUT_SOIGNIES_ECAUSSINNES",
    # HAINAUT_BRAINE_TUBIZE
    "Braine-le-Comte": "HAINAUT_BRAINE_TUBIZE",
    "Hennuyères": "HAINAUT_BRAINE_TUBIZE",
    "Rebecq": "HAINAUT_BRAINE_TUBIZE",
    "Tubize": "HAINAUT_BRAINE_TUBIZE",
    "Virginal-Samme": "HAINAUT_BRAINE_TUBIZE",
    "Braine-le-Château": "HAINAUT_BRAINE_TUBIZE",
    "Bierghes": "HAINAUT_BRAINE_TUBIZE",
    "Quenast": "HAINAUT_BRAINE_TUBIZE",
    "Ittre": "HAINAUT_BRAINE_TUBIZE",
    "Ronquières": "HAINAUT_BRAINE_TUBIZE",
    "Oisquercq": "HAINAUT_BRAINE_TUBIZE",
    "Saintes": "HAINAUT_BRAINE_TUBIZE",
    "Clabecq": "HAINAUT_BRAINE_TUBIZE",
    "Henripont": "HAINAUT_BRAINE_TUBIZE",
    "Haut-Ittre": "HAINAUT_BRAINE_TUBIZE",
    "Steenkerque": "HAINAUT_BRAINE_TUBIZE",
    "Wauthier-Braine": "HAINAUT_BRAINE_TUBIZE",
    "Wisbecq (Rebecq)": "HAINAUT_BRAINE_TUBIZE",
    # HAINAUT_ENGHIEN_SILLY
    "Enghien": "HAINAUT_ENGHIEN_SILLY",
    "Petit-Enghien": "HAINAUT_ENGHIEN_SILLY",
    "Marcq": "HAINAUT_ENGHIEN_SILLY",
    "Silly": "HAINAUT_ENGHIEN_SILLY",
    "Hoves": "HAINAUT_ENGHIEN_SILLY",
    "Bassilly": "HAINAUT_ENGHIEN_SILLY",
    "Herne": "HAINAUT_ENGHIEN_SILLY",
    "Sint-Pieters-Kapelle (Herne)": "HAINAUT_ENGHIEN_SILLY",
    "Graty": "HAINAUT_ENGHIEN_SILLY",
    "Thoricourt": "HAINAUT_ENGHIEN_SILLY",
    "Ghislenghien": "HAINAUT_ENGHIEN_SILLY",
    "Wannebecq": "HAINAUT_ENGHIEN_SILLY",
    "Heikruis": "HAINAUT_ENGHIEN_SILLY",
    "Pajottegem": "HAINAUT_ENGHIEN_SILLY",
    "Tollembeek": "HAINAUT_ENGHIEN_SILLY",
    # HAINAUT_ATH_LESSINES
    "Lessines": "HAINAUT_ATH_LESSINES",
    "Ollignies": "HAINAUT_ATH_LESSINES",
    "Flobecq": "HAINAUT_ATH_LESSINES",
    "Ath": "HAINAUT_ATH_LESSINES",
    "Brugelette": "HAINAUT_ATH_LESSINES",
    "Cambron-Saint-Vincent": "HAINAUT_ATH_LESSINES",
    "Chaussée-Notre-Dame-Louvignies": "HAINAUT_ATH_LESSINES",
    "Ellezelles": "HAINAUT_ATH_LESSINES",
    "Deux-Acren": "HAINAUT_ATH_LESSINES",
    "Ghoy": "HAINAUT_ATH_LESSINES",
    "Bois-de-Lessines": "HAINAUT_ATH_LESSINES",
    "Gibecq": "HAINAUT_ATH_LESSINES",
    "Wodecq": "HAINAUT_ATH_LESSINES",
    "Ath (Maffle)": "HAINAUT_ATH_LESSINES",
    "Frasnes-lez-Anvaing": "HAINAUT_ATH_LESSINES",
    "Lahamaide (Ellezelles)": "HAINAUT_ATH_LESSINES",
    "Lanquesaint (Ath)": "HAINAUT_ATH_LESSINES",
    "Mévergnies (Ath)": "HAINAUT_ATH_LESSINES",
    "Oeudeghien": "HAINAUT_ATH_LESSINES",
    "Ogy": "HAINAUT_ATH_LESSINES",
    "Papignies (Lessines)": "HAINAUT_ATH_LESSINES",
    # HAINAUT_MONS_JURBISE
    "Jurbise": "HAINAUT_MONS_JURBISE",
    "Lens": "HAINAUT_MONS_JURBISE",
    "Mons": "HAINAUT_MONS_JURBISE",
    "Casteau": "HAINAUT_MONS_JURBISE",
    "Ghlin": "HAINAUT_MONS_JURBISE",
    "Montignies-lez-Lens": "HAINAUT_MONS_JURBISE",
    "Obourg": "HAINAUT_MONS_JURBISE",
    "Bray": "HAINAUT_MONS_JURBISE",
    "Havré": "HAINAUT_MONS_JURBISE",
    "Jemappes": "HAINAUT_MONS_JURBISE",
    "Masnuy-Saint-Jean": "HAINAUT_MONS_JURBISE",
    "Erbisoeul": "HAINAUT_MONS_JURBISE",
    "Herchies": "HAINAUT_MONS_JURBISE",
    "Maisières": "HAINAUT_MONS_JURBISE",
    "Masnuy-Saint-Pierre": "HAINAUT_MONS_JURBISE",
    "Mons (Cuesmes)": "HAINAUT_MONS_JURBISE",
    "Saint-Denis": "HAINAUT_MONS_JURBISE",
    "Sirault": "HAINAUT_MONS_JURBISE",
    "St-Symphorien": "HAINAUT_MONS_JURBISE",
    "Baudour": "HAINAUT_MONS_JURBISE",
    # HAINAUT_OUEST_BORINAGE
    "Tournai": "HAINAUT_OUEST_BORINAGE",
    "Ville-Pommeroeul": "HAINAUT_OUEST_BORINAGE",
    "Mouscron": "HAINAUT_OUEST_BORINAGE",
    "Hainin": "HAINAUT_OUEST_BORINAGE",
    "Hornu": "HAINAUT_OUEST_BORINAGE",
    "Bernissart (Ville-Pommeroeul)": "HAINAUT_OUEST_BORINAGE",
    "Blaregnies": "HAINAUT_OUEST_BORINAGE",
    "Dour": "HAINAUT_OUEST_BORINAGE",
    "Hautrage": "HAINAUT_OUEST_BORINAGE",
    # HAINAUT_CENTRE_LALOUVIERE
    "Le Roeulx": "HAINAUT_CENTRE_LALOUVIERE",
    "Mignault": "HAINAUT_CENTRE_LALOUVIERE",
    "Petit-Roeulx-lez-Braine": "HAINAUT_CENTRE_LALOUVIERE",
    "Houdeng-Aimeries": "HAINAUT_CENTRE_LALOUVIERE",
    "Manage": "HAINAUT_CENTRE_LALOUVIERE",
    "La Louvière": "HAINAUT_CENTRE_LALOUVIERE",
    "Bois-d'Haine": "HAINAUT_CENTRE_LALOUVIERE",
    "Haine-Saint-Paul": "HAINAUT_CENTRE_LALOUVIERE",
    "Haine-Saint-Pierre": "HAINAUT_CENTRE_LALOUVIERE",
    "Seneffe": "HAINAUT_CENTRE_LALOUVIERE",
    "Arquennes": "HAINAUT_CENTRE_LALOUVIERE",
    "Feluy": "HAINAUT_CENTRE_LALOUVIERE",
    "Besonrieux": "HAINAUT_CENTRE_LALOUVIERE",
    "Chapelle-lez-Herlaimont": "HAINAUT_CENTRE_LALOUVIERE",
    "La Hestre": "HAINAUT_CENTRE_LALOUVIERE",
    "Saint-Vaast": "HAINAUT_CENTRE_LALOUVIERE",
    "Sars-la-Buysière": "HAINAUT_CENTRE_LALOUVIERE",
    "Strépy-Bracquegnies": "HAINAUT_CENTRE_LALOUVIERE",
    # HAINAUT_CHARLEROI_SUD
    "Fleurus": "HAINAUT_CHARLEROI_SUD",
    "Charleroi": "HAINAUT_CHARLEROI_SUD",
    "Gerpinnes": "HAINAUT_CHARLEROI_SUD",
    "Gozée": "HAINAUT_CHARLEROI_SUD",
    "Marcinelle": "HAINAUT_CHARLEROI_SUD",
    "Couillet (Charleroi)": "HAINAUT_CHARLEROI_SUD",
    "Gosselies": "HAINAUT_CHARLEROI_SUD",
    "Beaumont": "HAINAUT_CHARLEROI_SUD",
    "Ham-sur-Heure": "HAINAUT_CHARLEROI_SUD",
    "Thuin": "HAINAUT_CHARLEROI_SUD",
    "Pont-à-Celles": "HAINAUT_CHARLEROI_SUD",
    "Presles": "HAINAUT_CHARLEROI_SUD",
    "Obaix": "HAINAUT_CHARLEROI_SUD",
    # HAINAUT_BRABANT_BRUXELLES
    "Nivelles": "HAINAUT_BRABANT_BRUXELLES",
    "Waterloo": "HAINAUT_BRABANT_BRUXELLES",
    "Wavre": "HAINAUT_BRABANT_BRUXELLES",
    "Braine-l'Alleud": "HAINAUT_BRABANT_BRUXELLES",
    "Bruxelles": "HAINAUT_BRABANT_BRUXELLES",
    "Ixelles": "HAINAUT_BRABANT_BRUXELLES",
    "Louvain-la-Neuve": "HAINAUT_BRABANT_BRUXELLES",
    "Rixensart": "HAINAUT_BRABANT_BRUXELLES",
    "Uccle": "HAINAUT_BRABANT_BRUXELLES",
    "Woluwe-Saint-Lambert": "HAINAUT_BRABANT_BRUXELLES",
    "Baulers": "HAINAUT_BRABANT_BRUXELLES",
    "Bornival": "HAINAUT_BRABANT_BRUXELLES",
    "Halle": "HAINAUT_BRABANT_BRUXELLES",
    "Itterbeek": "HAINAUT_BRABANT_BRUXELLES",
    "Sint-Pieters-Leeuw": "HAINAUT_BRABANT_BRUXELLES",
    "Auderghem": "HAINAUT_BRABANT_BRUXELLES",
    "Baisy-Thy (Genappe)": "HAINAUT_BRABANT_BRUXELLES",
    "Bousval": "HAINAUT_BRABANT_BRUXELLES",
    "Bruxelles (Laeken)": "HAINAUT_BRABANT_BRUXELLES",
    "Dworp": "HAINAUT_BRABANT_BRUXELLES",
    "Genappe": "HAINAUT_BRABANT_BRUXELLES",
    "Lasne": "HAINAUT_BRABANT_BRUXELLES",
    "Limelette": "HAINAUT_BRABANT_BRUXELLES",
    "Linkebeek": "HAINAUT_BRABANT_BRUXELLES",
    "Molenbeek": "HAINAUT_BRABANT_BRUXELLES",
    "Ottignies-Louvain-la-Neuve": "HAINAUT_BRABANT_BRUXELLES",
    "Rixensart (Rosière)": "HAINAUT_BRABANT_BRUXELLES",
    "Vieux-Genappe": "HAINAUT_BRABANT_BRUXELLES",
    "Ways (Genappe)": "HAINAUT_BRABANT_BRUXELLES",
    "Woluwe-Saint-Pierre": "HAINAUT_BRABANT_BRUXELLES",
    # ARDENNES_BERTRIX_BOUILLON
    "Bertrix": "ARDENNES_BERTRIX_BOUILLON",
    "Bouillon": "ARDENNES_BERTRIX_BOUILLON",
    "Herbeumont": "ARDENNES_BERTRIX_BOUILLON",
    "Paliseul": "ARDENNES_BERTRIX_BOUILLON",
    "Noirfontaine": "ARDENNES_BERTRIX_BOUILLON",
    "Corbion": "ARDENNES_BERTRIX_BOUILLON",
    "Auby-sur-Semois": "ARDENNES_BERTRIX_BOUILLON",
    "Carlsbourg": "ARDENNES_BERTRIX_BOUILLON",
    "Sensenruth": "ARDENNES_BERTRIX_BOUILLON",
    "Fays-les-Veneurs": "ARDENNES_BERTRIX_BOUILLON",
    "Mogues": "ARDENNES_BERTRIX_BOUILLON",
    "Muno": "ARDENNES_BERTRIX_BOUILLON",
    "Offagne": "ARDENNES_BERTRIX_BOUILLON",
    "Cugnon": "ARDENNES_BERTRIX_BOUILLON",
    "Dohan": "ARDENNES_BERTRIX_BOUILLON",
    "Sart": "ARDENNES_BERTRIX_BOUILLON",
    # ARDENNES_SEMOIS_VRESSE_GEDINNE
    "Bièvre": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Gedinne": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Vencimont": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Bohan": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Pussemange": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Rienne": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Vresse-sur-Semois": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Gembes": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    "Louette-Saint-Denis": "ARDENNES_SEMOIS_VRESSE_GEDINNE",
    # ARDENNES_NEUFCHATEAU_LIBRAMONT
    "Neufchâteau": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Libramont-Chevigny": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Léglise": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Rulles": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Marbay": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Moircy": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Rossart": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Orsinfaing": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Warmifontaine": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Ebly": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Marbehan": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Namoussart": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Orgeo": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    "Saint-Pierre": "ARDENNES_NEUFCHATEAU_LIBRAMONT",
    # ARDENNES_SAINTHUBERT_LIBIN
    "Saint-Hubert": "ARDENNES_SAINTHUBERT_LIBIN",
    "Libin": "ARDENNES_SAINTHUBERT_LIBIN",
    "Redu": "ARDENNES_SAINTHUBERT_LIBIN",
    "Transinne": "ARDENNES_SAINTHUBERT_LIBIN",
    "Villance": "ARDENNES_SAINTHUBERT_LIBIN",
    "Hatrival": "ARDENNES_SAINTHUBERT_LIBIN",
    "Framont": "ARDENNES_SAINTHUBERT_LIBIN",
    "Anloy": "ARDENNES_SAINTHUBERT_LIBIN",
    "Laneuville-au-Bois": "ARDENNES_SAINTHUBERT_LIBIN",
    "Vesqueville": "ARDENNES_SAINTHUBERT_LIBIN",
    "Maissin": "ARDENNES_SAINTHUBERT_LIBIN",
    # ARDENNES_BASTOGNE
    "Bastogne": "ARDENNES_BASTOGNE",
    "Doncols": "ARDENNES_BASTOGNE",
    "Assenois": "ARDENNES_BASTOGNE",
    "Gribomont": "ARDENNES_BASTOGNE",
    "Recogne": "ARDENNES_BASTOGNE",
    "Morhet": "ARDENNES_BASTOGNE",
    "Sainte-Ode": "ARDENNES_BASTOGNE",
    "Labliau": "ARDENNES_BASTOGNE",
    # ARDENNES_GAUME_OUEST
    "Florenville": "ARDENNES_GAUME_OUEST",
    "Chiny": "ARDENNES_GAUME_OUEST",
    "Lacuisine": "ARDENNES_GAUME_OUEST",
    "Izel": "ARDENNES_GAUME_OUEST",
    "Jamoigne": "ARDENNES_GAUME_OUEST",
    "Les Bulles": "ARDENNES_GAUME_OUEST",
    "Sainte-Cécile": "ARDENNES_GAUME_OUEST",
    "Saint-Médard": "ARDENNES_GAUME_OUEST",
    "Pin": "ARDENNES_GAUME_OUEST",
    "Martilly": "ARDENNES_GAUME_OUEST",
    "Margny": "ARDENNES_GAUME_OUEST",
    "Nantimont": "ARDENNES_GAUME_OUEST",
    # ARDENNES_GAUME_EST_ARLON
    "Virton": "ARDENNES_GAUME_EST_ARLON",
    "Suxy": "ARDENNES_GAUME_EST_ARLON",
    "Rouvroy": "ARDENNES_GAUME_EST_ARLON",
    "Saint-Léger": "ARDENNES_GAUME_EST_ARLON",
    "Saint-Vincent": "ARDENNES_GAUME_EST_ARLON",
    "Tintigny": "ARDENNES_GAUME_EST_ARLON",
    "Étalle": "ARDENNES_GAUME_EST_ARLON",
    "Habay": "ARDENNES_GAUME_EST_ARLON",
    "Arlon": "ARDENNES_GAUME_EST_ARLON",
    # ARDENNES_FAMENNE_MARCHE
    "Barvaux-sur-Ourthe": "ARDENNES_FAMENNE_MARCHE",
    "Marche-en-Famenne": "ARDENNES_FAMENNE_MARCHE",
    "Hotton": "ARDENNES_FAMENNE_MARCHE",
    "Bomal": "ARDENNES_FAMENNE_MARCHE",
    "Grandhan": "ARDENNES_FAMENNE_MARCHE",
    "Izier": "ARDENNES_FAMENNE_MARCHE",
    "Ozo": "ARDENNES_FAMENNE_MARCHE",
    "Somme-Leuze": "ARDENNES_FAMENNE_MARCHE",
    "Forrières": "ARDENNES_FAMENNE_MARCHE",
    "Grandcourt": "ARDENNES_FAMENNE_MARCHE",
    "Érezée": "ARDENNES_FAMENNE_MARCHE",
    "Wellin": "ARDENNES_FAMENNE_MARCHE",
    "Buissonville": "ARDENNES_FAMENNE_MARCHE",
    "Chanly": "ARDENNES_FAMENNE_MARCHE",
    "Coustumont": "ARDENNES_FAMENNE_MARCHE",
    # ARDENNES_NAMUR_MEUSE
    "Beauraing": "ARDENNES_NAMUR_MEUSE",
    "Assesse": "ARDENNES_NAMUR_MEUSE",
    "Andenne": "ARDENNES_NAMUR_MEUSE",
    "Belgrade": "ARDENNES_NAMUR_MEUSE",
    "Durnal": "ARDENNES_NAMUR_MEUSE",
    "Franières": "ARDENNES_NAMUR_MEUSE",
    "Gembloux": "ARDENNES_NAMUR_MEUSE",
    "Naninne": "ARDENNES_NAMUR_MEUSE",
    "Sorinnes": "ARDENNES_NAMUR_MEUSE",
    "Biesme (Mettet)": "ARDENNES_NAMUR_MEUSE",
    "Mettet": "ARDENNES_NAMUR_MEUSE",
    "Sart-Saint-Laurent": "ARDENNES_NAMUR_MEUSE",
    # ARDENNES_EST_OUTLIERS
    "Awans": "ARDENNES_EST_OUTLIERS",
    "Crisnée": "ARDENNES_EST_OUTLIERS",
    "Hannut": "ARDENNES_EST_OUTLIERS",
    "Huy": "ARDENNES_EST_OUTLIERS",
    "Tongres-Notre-Dame": "ARDENNES_EST_OUTLIERS",
    "Villers-le-Bouillet": "ARDENNES_EST_OUTLIERS",
}


def normalize_apostrophe(s):
    for ch in ['\u2019', '\u2018', '\u02bc', '\u0060', '\u00b4']:
        s = s.replace(ch, "'")
    return s


def migrate():
    with engine.connect() as conn:
        tx = conn.begin()
        try:
            # 1. Créer les tables
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sub_zones (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    code VARCHAR(60) UNIQUE NOT NULL,
                    label VARCHAR(100) NOT NULL,
                    parent_zone VARCHAR(20) NOT NULL,
                    position INTEGER DEFAULT 0
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS city_sub_zones (
                    city VARCHAR(100) PRIMARY KEY,
                    sub_zone_id UUID REFERENCES sub_zones(id) ON DELETE SET NULL
                )
            """))
            conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS sub_zone VARCHAR(60)"))
            conn.execute(text("ALTER TABLE interventions ADD COLUMN IF NOT EXISTS sub_zone VARCHAR(60)"))
            print("✅ Tables et colonnes créées")

            # 2. Insérer les sous-zones
            for sz in SUB_ZONES:
                conn.execute(text("""
                    INSERT INTO sub_zones (code, label, parent_zone, position)
                    VALUES (:code, :label, :parent_zone, :position)
                    ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, position = EXCLUDED.position
                """), sz)
            print(f"✅ {len(SUB_ZONES)} sous-zones insérées")

            # 3. Insérer les mappings ville → sous-zone
            for city, code in CITY_ZONE_MAP.items():
                conn.execute(text("""
                    INSERT INTO city_sub_zones (city, sub_zone_id)
                    SELECT :city, id FROM sub_zones WHERE code = :code
                    ON CONFLICT (city) DO UPDATE SET sub_zone_id = EXCLUDED.sub_zone_id
                """), {"city": city, "code": code})
            print(f"✅ {len(CITY_ZONE_MAP)} mappings villes insérés")

            # 4. Normaliser clients.city (fusions)
            total_renamed = 0
            for old, new in CITY_MERGES.items():
                r = conn.execute(text(
                    "UPDATE clients SET city = :new WHERE TRIM(city) = :old AND city != :new"
                ), {"old": old, "new": new})
                if r.rowcount:
                    total_renamed += r.rowcount
                # Aussi normaliser apostrophes courbes de la même entrée
                old_norm = normalize_apostrophe(old)
                if old_norm != old:
                    r2 = conn.execute(text(
                        "UPDATE clients SET city = :new WHERE TRIM(city) = :old AND city != :new"
                    ), {"old": old_norm, "new": new})
                    if r2.rowcount:
                        total_renamed += r2.rowcount
            print(f"✅ {total_renamed} clients.city normalisés")

            # 5. Backfill clients.sub_zone
            r = conn.execute(text("""
                UPDATE clients c
                SET sub_zone = csz.sub_zone_id::text
                FROM city_sub_zones csz
                JOIN sub_zones sz ON sz.id = csz.sub_zone_id
                WHERE TRIM(c.city) = csz.city
                  AND c.sub_zone IS DISTINCT FROM sz.code
            """))
            # On stocke le code (ex: "HAINAUT_BRAINE_TUBIZE"), pas l'UUID
            conn.execute(text("""
                UPDATE clients c
                SET sub_zone = sz.code
                FROM city_sub_zones csz
                JOIN sub_zones sz ON sz.id = csz.sub_zone_id
                WHERE TRIM(c.city) = csz.city
            """))
            r2 = conn.execute(text("SELECT COUNT(*) FROM clients WHERE sub_zone IS NOT NULL"))
            print(f"✅ clients.sub_zone backfillé : {r2.fetchone()[0]} clients avec sous-zone")

            # 6. Backfill interventions.sub_zone depuis le client
            conn.execute(text("""
                UPDATE interventions i
                SET sub_zone = c.sub_zone
                FROM clients c
                WHERE i.client_id = c.id
                  AND c.sub_zone IS NOT NULL
            """))
            r3 = conn.execute(text("SELECT COUNT(*) FROM interventions WHERE sub_zone IS NOT NULL"))
            print(f"✅ interventions.sub_zone backfillé : {r3.fetchone()[0]} interventions avec sous-zone")

            tx.commit()
            print("🎉 Migration sous-zones terminée.")
        except Exception as e:
            tx.rollback()
            print(f"❌ Erreur : {e}")
            raise


if __name__ == "__main__":
    migrate()

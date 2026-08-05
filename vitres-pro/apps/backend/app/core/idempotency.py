"""
Idempotence des ecritures rejouees par la file d'attente hors-connexion du mobile.

Contexte : quand un ouvrier travaille sans reseau, ses actions sont mises en file
et rejouees au retour de la connexion. Un rejeu peut arriver alors que la requete
avait en fait abouti cote serveur (reponse perdue, app tuee en plein envoi).

Les PATCH n'ont pas besoin de protection : ils ne modifient que les cles fournies,
les rejouer donne le meme resultat. Les POST, eux, creent une ressource a chaque
appel — sans garde-fou, un rejeu produit un doublon (intervention en double, ou
notifications admin envoyees deux fois).

Le client genere donc un UUID par operation et le renvoie a chaque tentative.
On journalise cet id : s'il est deja connu, l'operation a deja abouti.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import ClientOperation


def already_processed(db: Session, op_id: Optional[UUID]) -> Optional[ClientOperation]:
    """
    Retourne l'operation deja journalisee pour cet id, sinon None.

    None signifie soit "pas d'id fourni" (appel normal depuis le web, sans file
    d'attente), soit "premiere execution" : dans les deux cas il faut executer.
    """
    if op_id is None:
        return None
    return db.query(ClientOperation).filter(ClientOperation.id == op_id).first()


def record_operation(
    db: Session,
    op_id: Optional[UUID],
    employee_id: Optional[UUID],
    endpoint: str,
    result_id: Optional[UUID] = None,
) -> None:
    """
    Journalise une operation client.

    A appeler AVANT le commit de l'ecriture metier, pour que les deux soient
    dans la meme transaction : sinon un crash entre les deux laisserait une
    ressource creee sans trace, et le rejeu la dupliquerait.

    Ne fait rien si aucun id n'est fourni (appel hors file d'attente).
    """
    if op_id is None:
        return
    db.add(
        ClientOperation(
            id=op_id,
            employee_id=employee_id,
            endpoint=endpoint,
            result_id=result_id,
        )
    )

import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { assertRevision, validateData } from './model'
export async function backup(uid, data, expectedRevision) {
  validateData(data)
  const ref = doc(db, 'users', uid, 'app', 'tracker')
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref)
    const revision = snapshot.exists() ? snapshot.data().revision : 0
    assertRevision(revision, expectedRevision)
    transaction.set(ref, { ...data, revision: revision + 1, updatedAt: serverTimestamp() })
    return revision + 1
  })
}
export async function restore(uid) {
  const snapshot = await getDocFromServer(doc(db, 'users', uid, 'app', 'tracker'))
  if (!snapshot.exists()) throw Error('No cloud backup found.')
  return { data: validateData(snapshot.data()), revision: snapshot.data().revision }
}

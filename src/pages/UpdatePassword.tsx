import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

const handleUpdatePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!supabase) {
      setMessage('Supabase no está configurado correctamente.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')
    }

    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: 20 }}>
      <h1>Cambiar contraseña</h1>

      <form onSubmit={handleUpdatePassword}>
        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{
            width: '100%',
            padding: 10,
            marginBottom: 12,
            border: '1px solid #ccc',
            borderRadius: 6,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 10,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}
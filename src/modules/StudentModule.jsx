import { useEffect, useMemo, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const USUARIOS_BASE = [
  {
    nombre: 'José Pallares',
    correo: 'jose.pallares@epn.edu.ec',
    clave: '123456789',
    codigo_estudiante: 'EPN-2026-081'
  },
  {
    nombre: 'Lady Velásquez',
    correo: 'lady.velasquez@epn.edu.ec',
    clave: '123456789',
    codigo_estudiante: 'EPN-2026-082'
  },
  {
    nombre: 'Nicolás Yugsi',
    correo: 'nicolas.yugsi@epn.edu.ec',
    clave: '123456789',
    codigo_estudiante: 'EPN-2026-083'
  }
]

const ESPACIOS_LABORATORIO = [
  ...Array.from({ length: 9 }, (_, i) => `E20/P3/0${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `E20/P5/0${i + 1}`),
  'LABORATORIO ADA',
  'ALAN TURING',
  'INTELIGENCIA ARTIFICIAL'
]

const TIPOS_REPORTE = [
  'Daño de equipo',
  'Falla de red o energía',
  'Queja de servicio',
  'Insumo o periférico defectuoso'
]

export default function StudentModule({ module }) {
  const [modoAuth, setModoAuth] = useState('login')
  const [authForm, setAuthForm] = useState({
    nombre: '',
    correo: '',
    clave: ''
  })
  const [usuarioActivo, setUsuarioActivo] = useState(null)

  const [vistaApp, setVistaApp] = useState('reportar')
  const [form, setForm] = useState({
    tipo_solicitud: TIPOS_REPORTE[0],
    laboratorio: ESPACIOS_LABORATORIO[0],
    equipo: '',
    prioridad: 'Media',
    descripcion: ''
  })

  const [reportes, setReportes] = useState([])
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoLista, setCargandoLista] = useState(false)

  const esModuloDanos =
    module?.number === 3 ||
    module?.number === 8 ||
    String(module?.id || '').toLowerCase().includes('dano') ||
    String(module?.id || '').toLowerCase().includes('daño') ||
    String(module?.id || '').toLowerCase().includes('soporte') ||
    String(module?.name || '').toLowerCase().includes('daño') ||
    String(module?.name || '').toLowerCase().includes('soporte')

  async function cargarReportesUsuario(correo) {
    if (!supabase || !isConfigured || !correo) {
      setReportes([])
      return
    }
    setCargandoLista(true)
    const { data, error: err } = await supabase
      .from('reportes_danos')
      .select('id,codigo_estudiante,correo_reportante,nombre_reportante,tipo_solicitud,equipo,laboratorio,prioridad,descripcion,estado,created_at')
      .eq('correo_reportante', correo.toLowerCase())
      .order('created_at', { ascending: false })
    setCargandoLista(false)

    if (err) {
      setError('No se pudo cargar el historial de reportes: ' + err.message)
      return
    }
    setReportes(data || [])
  }

  useEffect(() => {
    if (usuarioActivo?.correo) {
      cargarReportesUsuario(usuarioActivo.correo)
    }
  }, [usuarioActivo?.correo])

  async function buscarUsuarioEnBd(correoNormalizado) {
    if (!supabase || !isConfigured) return null
    const { data, error: err } = await supabase
      .from('perfiles_reporte')
      .select('nombre,correo,clave,codigo_estudiante')
      .eq('correo', correoNormalizado)
      .maybeSingle()
    if (err) return null
    return data || null
  }

  async function manejarLogin(e) {
    e.preventDefault()
    setError('')
    setExito('')

    const correoNorm = authForm.correo.trim().toLowerCase()
    const claveIngresada = authForm.clave

    if (!correoNorm || !claveIngresada) {
      setError('Ingresa tu correo electrónico y contraseña.')
      return
    }

    setCargando(true)
    let cuenta = await buscarUsuarioEnBd(correoNorm)
    if (!cuenta) {
      cuenta = USUARIOS_BASE.find(u => u.correo.toLowerCase() === correoNorm) || null
    }
    setCargando(false)

    if (!cuenta) {
      setError('Acceso denegado: el correo ingresado no está registrado en el sistema.')
      return
    }

    if (cuenta.clave !== claveIngresada) {
      setError('Contraseña incorrecta.')
      return
    }

    setUsuarioActivo(cuenta)
    setAuthForm({ nombre: '', correo: '', clave: '' })
    setVistaApp('reportar')
    setExito(`Sesión iniciada como ${cuenta.nombre}.`)
    await cargarReportesUsuario(cuenta.correo)
  }

  async function manejarRegistro(e) {
    e.preventDefault()
    setError('')
    setExito('')

    const nombreLimpio = authForm.nombre.trim()
    const correoNorm = authForm.correo.trim().toLowerCase()
    const claveIngresada = authForm.clave

    if (nombreLimpio.length < 3) {
      setError('Ingresa tu nombre completo.')
      return
    }
    if (!correoNorm.includes('@') || !correoNorm.includes('.')) {
      setError('Ingresa un correo electrónico válido.')
      return
    }
    if (claveIngresada.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setCargando(true)
    const existente = await buscarUsuarioEnBd(correoNorm)
    const enBase = USUARIOS_BASE.some(u => u.correo.toLowerCase() === correoNorm)

    if (existente || enBase) {
      setCargando(false)
      setError('Este correo ya cuenta con un usuario registrado. Inicia sesión.')
      return
    }

    const nuevoPerfil = {
      nombre: nombreLimpio,
      correo: correoNorm,
      clave: claveIngresada,
      codigo_estudiante: 'EPN-' + Math.floor(100000 + Math.random() * 900000)
    }

    if (supabase && isConfigured) {
      const { error: insErr } = await supabase
        .from('perfiles_reporte')
        .insert(nuevoPerfil)
      if (insErr) {
        setCargando(false)
        setError('No se pudo registrar la cuenta: ' + insErr.message)
        return
      }
    }

    setCargando(false)
    setUsuarioActivo(nuevoPerfil)
    setAuthForm({ nombre: '', correo: '', clave: '' })
    setVistaApp('reportar')
    setExito(`Cuenta creada para ${nuevoPerfil.nombre}.`)
  }

  function cerrarSesionPortal() {
    setUsuarioActivo(null)
    setReportes([])
    setError('')
    setExito('')
    setModoAuth('login')
  }

  async function manejarEnviarReporte(e) {
    e.preventDefault()
    setError('')
    setExito('')

    const equipoMayus = form.equipo.trim().toUpperCase()
    if (!equipoMayus) {
      setError('Indica el equipo o estación afectado.')
      return
    }
    if (!form.descripcion.trim()) {
      setError('Escribe la descripción del daño o queja.')
      return
    }
    if (!supabase || !isConfigured || !usuarioActivo) {
      setError('No hay conexión activa con la base de datos.')
      return
    }

    setCargando(true)
    const { data, error: insErr } = await supabase
      .from('reportes_danos')
      .insert({
        codigo_estudiante: usuarioActivo.codigo_estudiante,
        correo_reportante: usuarioActivo.correo,
        nombre_reportante: usuarioActivo.nombre,
        tipo_solicitud: form.tipo_solicitud,
        laboratorio: form.laboratorio,
        equipo: equipoMayus,
        prioridad: form.prioridad,
        descripcion: form.descripcion.trim(),
        estado: 'Pendiente'
      })
      .select('id')
      .single()
    setCargando(false)

    if (insErr) {
      setError('No se pudo guardar el reporte: ' + insErr.message)
      return
    }

    const folio = data?.id ? data.id.slice(0, 8).toUpperCase() : 'OK'
    setExito(`Reporte #${folio} guardado a nombre de ${usuarioActivo.nombre}.`)
    setForm({
      tipo_solicitud: form.tipo_solicitud,
      laboratorio: form.laboratorio,
      equipo: '',
      prioridad: 'Media',
      descripcion: ''
    })
    await cargarReportesUsuario(usuarioActivo.correo)
    setVistaApp('dashboard')
  }

  const metricas = useMemo(() => {
    const total = reportes.length
    const pendientes = reportes.filter(r => r.estado === 'Pendiente').length
    const enRevision = reportes.filter(r => r.estado === 'En revisión').length
    const resueltos = reportes.filter(r => r.estado !== 'Pendiente' && r.estado !== 'En revisión').length
    const altaUrgencia = reportes.filter(r => r.prioridad === 'Alta').length
    return { total, pendientes, enRevision, resueltos, altaUrgencia }
  }, [reportes])

  if (!esModuloDanos) {
    return (
      <div className="module-page">
        <div className="eyebrow">MÓDULO {module.number}</div>
        <h2>{module.name}</h2>
        <p className="muted">{module.summary}</p>
        <div className="panel">
          <p className="muted">Módulo en desarrollo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="module-page">
      <style>{`
        .dmg-shell { display: flex; flex-direction: column; gap: 20px; }
        .dmg-banner {
          background: linear-gradient(135deg, #0f294a 0%, #1762e8 60%, #0ea5e9 100%);
          color: #ffffff;
          border-radius: 18px;
          padding: 26px 28px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: 0 12px 28px rgba(23, 98, 232, 0.18);
        }
        .dmg-banner h2 { color: #ffffff; margin: 4px 0 6px; font-size: clamp(22px, 2.6vw, 30px); }
        .dmg-banner p { color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; max-width: 620px; }
        .dmg-tag {
          display: inline-block;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.28);
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .dmg-session-box {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 14px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .dmg-session-box strong { display: block; font-size: 14px; }
        .dmg-session-box span { font-size: 12px; opacity: 0.9; }
        .dmg-btn-ghost {
          background: rgba(255,255,255,0.16) !important;
          border: 1px solid rgba(255,255,255,0.4) !important;
          color: #ffffff !important;
        }
        .dmg-auth-card {
          max-width: 500px;
          width: 100%;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
        }
        .dmg-switch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          background: #f1f5f9;
          padding: 5px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .dmg-switch button {
          border: 0 !important;
          background: transparent !important;
          color: #475569 !important;
          border-radius: 9px !important;
          padding: 10px !important;
          font-weight: 700;
          justify-content: center;
        }
        .dmg-switch button.active {
          background: #ffffff !important;
          color: #1762e8 !important;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }
        .dmg-nav-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .dmg-nav-btn {
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          color: #1e293b !important;
          border-radius: 11px !important;
          padding: 11px 18px !important;
        }
        .dmg-nav-btn.active {
          background: #1762e8 !important;
          border-color: #1762e8 !important;
          color: #ffffff !important;
        }
        .dmg-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .dmg-form-full {
          grid-column: 1 / -1;
        }
        .dmg-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .dmg-kpi {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px 20px;
          position: relative;
          overflow: hidden;
        }
        .dmg-kpi::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: var(--accent, #1762e8);
        }
        .dmg-kpi small { color: #64748b; font-size: 12px; font-weight: 600; display: block; }
        .dmg-kpi strong { font-size: 28px; color: #0f172a; display: block; margin-top: 6px; }
        .dmg-bars { display: flex; flex-direction: column; gap: 14px; }
        .dmg-bar-row { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
        .dmg-bar-head { display: flex; justify-content: space-between; color: #334155; font-weight: 600; }
        .dmg-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
        .dmg-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
        .badge-prio {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }
        .prio-Alta { background: #fee2e2; color: #b91c1c; }
        .prio-Media { background: #fef3c7; color: #b45309; }
        .prio-Baja { background: #e0f2fe; color: #0369a1; }
        @media (max-width: 960px) {
          .dmg-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 680px) {
          .dmg-form-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .dmg-banner { padding: 20px; }
          .dmg-auth-card { padding: 20px; }
          .dmg-kpis { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dmg-shell">
        <div className="dmg-banner">
          <div>
            <span className="dmg-tag">Laboratorios FIS · Atención al Usuario</span>
            <h2>Reporte de Daños y Quejas</h2>
            <p>
              Registra fallas en equipos, incidencias en aulas o quejas de servicio y consulta el estado de tus reportes.
            </p>
          </div>

          {usuarioActivo && (
            <div className="dmg-session-box">
              <div>
                <strong>{usuarioActivo.nombre}</strong>
                <span>{usuarioActivo.correo}</span>
              </div>
              <button type="button" className="small dmg-btn-ghost" onClick={cerrarSesionPortal}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {exito && <div className="message success" role="status">{exito}</div>}

        {!usuarioActivo ? (
          <div className="dmg-auth-card">
            <div className="dmg-switch">
              <button
                type="button"
                className={modoAuth === 'login' ? 'active' : ''}
                onClick={() => { setModoAuth('login'); setError(''); setExito('') }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={modoAuth === 'register' ? 'active' : ''}
                onClick={() => { setModoAuth('register'); setError(''); setExito('') }}
              >
                Crear cuenta
              </button>
            </div>

            {modoAuth === 'login' ? (
              <form onSubmit={manejarLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0 }}>Acceso al portal</h3>
                <label>
                  Correo electrónico *
                  <input
                    type="email"
                    value={authForm.correo}
                    onChange={e => setAuthForm({ ...authForm, correo: e.target.value })}
                    placeholder="usuario@epn.edu.ec"
                  />
                </label>
                <label>
                  Contraseña *
                  <input
                    type="password"
                    value={authForm.clave}
                    onChange={e => setAuthForm({ ...authForm, clave: e.target.value })}
                    placeholder="Ingresa tu contraseña"
                  />
                </label>
                <button type="submit" disabled={cargando}>
                  {cargando ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>
            ) : (
              <form onSubmit={manejarRegistro} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0 }}>Crear nueva cuenta</h3>
                <label>
                  Nombre completo *
                  <input
                    value={authForm.nombre}
                    onChange={e => setAuthForm({ ...authForm, nombre: e.target.value })}
                    placeholder="Nombre y apellido"
                  />
                </label>
                <label>
                  Correo electrónico *
                  <input
                    type="email"
                    value={authForm.correo}
                    onChange={e => setAuthForm({ ...authForm, correo: e.target.value })}
                    placeholder="usuario@epn.edu.ec"
                  />
                </label>
                <label>
                  Contraseña *
                  <input
                    type="password"
                    value={authForm.clave}
                    onChange={e => setAuthForm({ ...authForm, clave: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                </label>
                <button type="submit" disabled={cargando}>
                  {cargando ? 'Registrando...' : 'Crear cuenta'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="dmg-nav-bar">
              <button
                type="button"
                className={`dmg-nav-btn ${vistaApp === 'reportar' ? 'active' : ''}`}
                onClick={() => { setVistaApp('reportar'); setError(''); setExito('') }}
              >
                Registrar reporte
              </button>
              <button
                type="button"
                className={`dmg-nav-btn ${vistaApp === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setVistaApp('dashboard'); setError(''); setExito(''); cargarReportesUsuario(usuarioActivo.correo) }}
              >
                Dashboard de reportes ({metricas.total})
              </button>
            </div>

            {vistaApp === 'reportar' ? (
              <div className="split">
                <section className="panel" style={{ marginTop: 0 }}>
                  <h3>Formulario de reporte · {usuarioActivo.nombre}</h3>
                  <form onSubmit={manejarEnviarReporte}>
                    <div className="dmg-form-grid">
                      <label>
                        Reportante
                        <input value={usuarioActivo.nombre} disabled />
                      </label>

                      <label>
                        Tipo de reporte
                        <select
                          value={form.tipo_solicitud}
                          onChange={e => setForm({ ...form, tipo_solicitud: e.target.value })}
                        >
                          {TIPOS_REPORTE.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Laboratorio o espacio *
                        <select
                          value={form.laboratorio}
                          onChange={e => setForm({ ...form, laboratorio: e.target.value })}
                        >
                          {ESPACIOS_LABORATORIO.map(espacio => (
                            <option key={espacio} value={espacio}>{espacio}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Urgencia
                        <select
                          value={form.prioridad}
                          onChange={e => setForm({ ...form, prioridad: e.target.value })}
                        >
                          <option value="Baja">Baja</option>
                          <option value="Media">Media</option>
                          <option value="Alta">Alta</option>
                        </select>
                      </label>

                      <label className="dmg-form-full">
                        Equipo o recurso afectado *
                        <input
                          value={form.equipo}
                          onChange={e => setForm({ ...form, equipo: e.target.value.toUpperCase() })}
                          placeholder="EJ.: PC-12, OSCILOSCOPIO #3, PROYECTOR"
                        />
                      </label>

                      <label className="dmg-form-full">
                        Descripción del daño o queja *
                        <input
                          value={form.descripcion}
                          onChange={e => setForm({ ...form, descripcion: e.target.value })}
                          placeholder="Describe la falla o inconveniente presentado"
                        />
                      </label>
                    </div>

                    <div className="button-row">
                      <button type="submit" disabled={cargando}>
                        {cargando ? 'Enviando...' : 'Enviar reporte'}
                      </button>
                      <button type="button" className="secondary" onClick={() => setVistaApp('dashboard')}>
                        Ver dashboard
                      </button>
                    </div>
                  </form>
                </section>

                <section className="panel" style={{ marginTop: 0 }}>
                  <h3>Estado de tus reportes</h3>
                  <p className="muted">
                    Cada reporte queda registrado bajo <strong>{usuarioActivo.nombre}</strong> ({usuarioActivo.correo}) y se actualiza en tu historial.
                  </p>
                  <div className="dmg-bars" style={{ marginTop: '18px' }}>
                    <div className="dmg-bar-row">
                      <div className="dmg-bar-head">
                        <span>Pendientes</span>
                        <span>{metricas.pendientes} de {metricas.total}</span>
                      </div>
                      <div className="dmg-track">
                        <div
                          className="dmg-fill"
                          style={{
                            width: `${metricas.total ? Math.round((metricas.pendientes / metricas.total) * 100) : 0}%`,
                            background: '#f59e0b'
                          }}
                        />
                      </div>
                    </div>

                    <div className="dmg-bar-row">
                      <div className="dmg-bar-head">
                        <span>En revisión / Atendidos</span>
                        <span>{metricas.enRevision + metricas.resueltos} de {metricas.total}</span>
                      </div>
                      <div className="dmg-track">
                        <div
                          className="dmg-fill"
                          style={{
                            width: `${metricas.total ? Math.round(((metricas.enRevision + metricas.resueltos) / metricas.total) * 100) : 0}%`,
                            background: '#10b981'
                          }}
                        />
                      </div>
                    </div>

                    <div className="dmg-bar-row">
                      <div className="dmg-bar-head">
                        <span>Urgencia alta</span>
                        <span>{metricas.altaUrgencia} de {metricas.total}</span>
                      </div>
                      <div className="dmg-track">
                        <div
                          className="dmg-fill"
                          style={{
                            width: `${metricas.total ? Math.round((metricas.altaUrgencia / metricas.total) * 100) : 0}%`,
                            background: '#ef4444'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <>
                <div className="dmg-kpis">
                  <div className="dmg-kpi" style={{ '--accent': '#1762e8' }}>
                    <small>Total reportes</small>
                    <strong>{metricas.total}</strong>
                  </div>
                  <div className="dmg-kpi" style={{ '--accent': '#f59e0b' }}>
                    <small>Pendientes</small>
                    <strong>{metricas.pendientes}</strong>
                  </div>
                  <div className="dmg-kpi" style={{ '--accent': '#0ea5e9' }}>
                    <small>En revisión</small>
                    <strong>{metricas.enRevision}</strong>
                  </div>
                  <div className="dmg-kpi" style={{ '--accent': '#ef4444' }}>
                    <small>Urgencia alta</small>
                    <strong>{metricas.altaUrgencia}</strong>
                  </div>
                </div>

                <section className="panel" style={{ marginTop: 0 }}>
                  <div className="between" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3>Historial de reportes · {usuarioActivo.nombre}</h3>
                    <div className="right">
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => cargarReportesUsuario(usuarioActivo.correo)}
                        disabled={cargandoLista}
                      >
                        {cargandoLista ? 'Actualizando...' : 'Actualizar'}
                      </button>
                      <button
                        type="button"
                        className="small"
                        onClick={() => { setVistaApp('reportar'); setError(''); setExito('') }}
                      >
                        + Nuevo reporte
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Tipo</th>
                          <th>Laboratorio / Espacio</th>
                          <th>Equipo</th>
                          <th>Urgencia</th>
                          <th>Descripción</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportes.length ? (
                          reportes.map(item => (
                            <tr key={item.id}>
                              <td><strong>#{item.id.slice(0, 8).toUpperCase()}</strong></td>
                              <td>{item.tipo_solicitud}</td>
                              <td>{item.laboratorio}</td>
                              <td>{item.equipo}</td>
                              <td>
                                <span className={`badge-prio prio-${item.prioridad}`}>
                                  {item.prioridad}
                                </span>
                              </td>
                              <td>{item.descripcion}</td>
                              <td><span className="status">{item.estado}</span></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="empty">
                              Aún no tienes reportes registrados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
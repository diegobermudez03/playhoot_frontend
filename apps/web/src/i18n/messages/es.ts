import type { Messages } from './en';

// Spanish (neutral, Latin American "tú").
export const es: Messages = {
  'app.tagline': 'Noche de juegos, donde sea.',
  'app.homeLink': 'Inicio de Playhoot',
  'language.label': 'Idioma',
  'sound.mute': 'Silenciar el sonido',
  'sound.unmute': 'Activar el sonido',

  'home.title': 'Únete a una partida',
  'home.codeLabel': 'Código de la partida',
  'home.join': 'Unirme',
  'home.footnote': '¿Tu anfitrión te dio un código? Escríbelo arriba.',

  'identity.title': '¿Cómo te llamamos?',
  'identity.joining': 'Te estás uniendo a la partida <mark>{code}</mark>',
  'identity.nameLabel': 'Tu nombre',
  'identity.namePlaceholder': 'p. ej. Búho Nocturno',
  'identity.nameHint': 'Así te verán los demás jugadores.',
  'identity.submit': '¡A jugar!',
  'identity.error.empty': 'Escribe un nombre para continuar.',
  'identity.error.tooLong': 'Usa como máximo {max} caracteres.',
  'identity.error.rejected': 'No se puede usar ese nombre. Prueba con otro.',
  'identity.error.rateLimited':
    '{seconds, plural, =0 {Demasiados intentos. Espera un momento y vuelve a intentarlo.} one {Demasiados intentos. Espera # segundo y vuelve a intentarlo.} other {Demasiados intentos. Espera # segundos y vuelve a intentarlo.}}',
  'identity.error.unavailable':
    'No pudimos conectar con Playhoot. Inténtalo de nuevo en un momento.',

  'connecting.joining': 'Uniéndote a la partida…',
  'connecting.joiningCode': 'Uniéndote a {code}…',
  'connecting.reconnecting': 'Se perdió la conexión. Reconectando…',
  'connecting.leaving': 'Saliendo de la partida…',

  'lobby.title': '¡Ya estás dentro!',
  'lobby.waiting': 'Esperando a que el anfitrión inicie la partida',
  'lobby.invite.title': 'Invita a tus amigos',
  'lobby.invite.withCode': 'Comparte este código o el enlace',
  'lobby.invite.withoutCode': 'Envíales el enlace de esta partida.',
  'lobby.invite.codeLabel': 'Código de la partida {code}',
  'lobby.invite.copy': 'Copiar enlace de invitación',
  'lobby.invite.copied': '¡Enlace copiado!',
  'lobby.players': 'Jugadores',
  'lobby.you': 'Tú',
  'lobby.playerName': 'Jugador {seat}',
  'lobby.leave': 'Salir de la partida',

  'started.title': '¡Empieza el juego!',
  'started.body': 'Eres el jugador <b>{seat}</b> de {total}. Cargando el juego…',
  'started.bodyNamed': '{name}, eres el jugador <b>{seat}</b> de {total}. Cargando el juego…',

  'outcome.unreachable.title': 'No encontramos esa partida',
  'outcome.unreachable.body':
    'Puede que el código esté mal escrito o haya expirado, o que la partida ya haya empezado. Confírmalo con tu anfitrión.',
  'outcome.lobbyFull.title': 'La partida está llena',
  'outcome.lobbyFull.body':
    'Todos los lugares están ocupados. Pídele al anfitrión que inicie otra ronda.',
  'outcome.sessionStarted.title': 'Esta partida ya empezó',
  'outcome.sessionStarted.body':
    'Solo pueden jugar esta ronda quienes estaban en la sala de espera.',
  'outcome.cannotRejoin.title': 'No puedes volver a esta partida',
  'outcome.cannotRejoin.body': 'La partida siguió sin ti. ¡Únete a la próxima ronda!',
  'outcome.busy.title': 'Playhoot está muy ocupado ahora',
  'outcome.busy.body': 'Espera un momento e inténtalo de nuevo.',
  'outcome.unavailable.title': 'Esta partida no está disponible',
  'outcome.unavailable.body':
    'Puede que haya terminado o expirado. Pídele un código nuevo a tu anfitrión.',
  'outcome.lobbyExpired.title': 'La sala de espera se cerró',
  'outcome.lobbyExpired.body': 'La partida nunca empezó y se acabó el tiempo de la sala.',
  'outcome.hostClosedLobby.title': 'El anfitrión cerró la partida',
  'outcome.hostClosedLobby.body': 'Esta ronda se canceló antes de empezar.',
  'outcome.hostEnded.title': 'El anfitrión terminó la partida',
  'outcome.hostEnded.body': 'Esta ronda se detuvo antes del final.',
  'outcome.finished.title': '¡Fin del juego!',
  'outcome.finished.body': 'Gracias por jugar.',
  'outcome.ended.title': 'Esta partida terminó',
  'outcome.ended.body': 'La ronda terminó.',
  'outcome.replaced.title': 'Abriste esta partida en otro lugar',
  'outcome.replaced.body': 'Esta pestaña ya no está conectada. Puedes seguir jugando aquí.',
  'outcome.connectionLost.title': 'Se perdió la conexión',
  'outcome.connectionLost.body':
    'No pudimos conectar con la partida. Revisa tu internet e inténtalo de nuevo.',
  'outcome.protocolError.title': 'Algo salió mal',
  'outcome.protocolError.body':
    'La partida y esta página dejaron de entenderse. Volver a intentarlo suele solucionarlo.',
  'outcome.left.title': 'Saliste de la partida',
  'outcome.left.body': 'Vuelve cuando quieras con un código.',
  'outcome.action.retry': 'Intentar de nuevo',
  'outcome.action.playHere': 'Jugar aquí',
  'outcome.action.enterCode': 'Ingresar un código',

  'notFound.title': 'Aquí no hay nada',
  'notFound.body': 'Esta página salió volando.',
  'error.title': 'Algo salió mal',
  'common.goHome': 'Ir al inicio',
};

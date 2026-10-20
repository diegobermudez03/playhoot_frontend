import type { Messages } from './en';

// Brazilian Portuguese ("você").
export const ptBR: Messages = {
  'app.tagline': 'Noite de jogos, em qualquer lugar.',
  'app.homeLink': 'Início do Playhoot',
  'language.label': 'Idioma',
  'sound.mute': 'Desativar o som',
  'sound.unmute': 'Ativar o som',

  'enterCode.title': 'Entre em uma partida',
  'enterCode.codeLabel': 'Código da partida',
  'enterCode.join': 'Entrar',
  'enterCode.footnote': 'Recebeu um código do anfitrião? Digite acima.',

  'identity.title': 'Como devemos te chamar?',
  'identity.joining': 'Você está entrando na partida <mark>{code}</mark>',
  'identity.nameLabel': 'Seu nome',
  'identity.namePlaceholder': 'ex.: Coruja Noturna',
  'identity.nameHint': 'É assim que os outros jogadores vão te ver.',
  'identity.submit': 'Bora jogar',
  'identity.error.empty': 'Digite um nome para continuar.',
  'identity.error.tooLong': 'Use no máximo {max} caracteres.',
  'identity.error.rejected': 'Esse nome não pode ser usado. Tente outro.',
  'identity.error.rateLimited':
    '{seconds, plural, =0 {Muitas tentativas. Aguarde um momento e tente de novo.} one {Muitas tentativas. Aguarde # segundo e tente de novo.} other {Muitas tentativas. Aguarde # segundos e tente de novo.}}',
  'identity.error.unavailable': 'Não conseguimos falar com o Playhoot. Tente de novo em instantes.',

  'connecting.joining': 'Entrando na partida…',
  'connecting.joiningCode': 'Entrando em {code}…',
  'connecting.reconnecting': 'Conexão perdida. Reconectando…',
  'connecting.leaving': 'Saindo da partida…',

  'lobby.title': 'Você está dentro!',
  'lobby.waiting': 'Esperando o anfitrião iniciar a partida',
  'lobby.invite.title': 'Convide seus amigos',
  'lobby.invite.withCode': 'Compartilhe este código ou o link',
  'lobby.invite.withoutCode': 'Envie para eles o link desta partida.',
  'lobby.invite.codeLabel': 'Código da partida {code}',
  'lobby.invite.copy': 'Copiar link de convite',
  'lobby.invite.copied': 'Link copiado!',
  'lobby.players': 'Jogadores',
  'lobby.you': 'Você',
  'lobby.playerName': 'Jogador {seat}',
  'lobby.leave': 'Sair da partida',

  'started.title': 'Começou o jogo!',
  'started.body': 'Você é o jogador <b>{seat}</b> de {total}. Carregando o jogo…',
  'started.bodyNamed': '{name}, você é o jogador <b>{seat}</b> de {total}. Carregando o jogo…',

  'outcome.unreachable.title': 'Não encontramos essa partida',
  'outcome.unreachable.body':
    'O código pode estar errado ou expirado, ou a partida já começou. Confirme com o anfitrião.',
  'outcome.lobbyFull.title': 'A partida está cheia',
  'outcome.lobbyFull.body':
    'Todos os lugares estão ocupados. Peça ao anfitrião para começar outra rodada.',
  'outcome.sessionStarted.title': 'Essa partida já começou',
  'outcome.sessionStarted.body': 'Só quem estava na sala de espera pode jogar esta rodada.',
  'outcome.cannotRejoin.title': 'Você não pode voltar para esta partida',
  'outcome.cannotRejoin.body': 'A partida continuou sem você. Entre na próxima rodada!',
  'outcome.busy.title': 'O Playhoot está muito ocupado agora',
  'outcome.busy.body': 'Aguarde um momento e tente de novo.',
  'outcome.unavailable.title': 'Esta partida não está disponível',
  'outcome.unavailable.body':
    'Ela pode ter terminado ou expirado. Peça um novo código ao anfitrião.',
  'outcome.lobbyExpired.title': 'A sala de espera fechou',
  'outcome.lobbyExpired.body': 'A partida não começou e o tempo da sala acabou.',
  'outcome.hostClosedLobby.title': 'O anfitrião fechou a partida',
  'outcome.hostClosedLobby.body': 'Esta rodada foi cancelada antes de começar.',
  'outcome.hostEnded.title': 'O anfitrião encerrou a partida',
  'outcome.hostEnded.body': 'Esta rodada parou antes do fim.',
  'outcome.finished.title': 'Fim de jogo!',
  'outcome.finished.body': 'Obrigado por jogar.',
  'outcome.ended.title': 'Esta partida terminou',
  'outcome.ended.body': 'A rodada acabou.',
  'outcome.replaced.title': 'Você abriu esta partida em outro lugar',
  'outcome.replaced.body': 'Esta aba não está mais conectada. Você pode continuar jogando aqui.',
  'outcome.connectionLost.title': 'Conexão perdida',
  'outcome.connectionLost.body':
    'Não conseguimos falar com a partida. Verifique sua internet e tente de novo.',
  'outcome.protocolError.title': 'Algo deu errado',
  'outcome.protocolError.body':
    'A partida e esta página pararam de se entender. Tentar de novo geralmente resolve.',
  'outcome.left.title': 'Você saiu da partida',
  'outcome.left.body': 'Volte quando quiser com um código.',
  'outcome.action.retry': 'Tentar de novo',
  'outcome.action.playHere': 'Jogar aqui',
  'outcome.action.enterCode': 'Digitar um código',

  'notFound.title': 'Não tem nada aqui',
  'notFound.body': 'Esta página saiu voando.',
  'error.title': 'Algo deu errado',
  'common.goHome': 'Ir para o início',
};

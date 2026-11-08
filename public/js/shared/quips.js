/**
 * Referências da cultura pop sorteadas pelas telas, só para divertir: nunca
 * substituem instruções nem mensagens de erro. Para incluir uma nova, basta
 * acrescentar { emoji, text, source } na lista do momento desejado.
 */
export const QUIPS = {
  // Uma por categoria da cédula, sem repetir até acabar o baralho.
  general: [
    { emoji: '🌌', text: 'Que a Força esteja com você.', source: 'Star Wars' },
    { emoji: '🚀', text: 'Ao infinito e além!', source: 'Toy Story' },
    { emoji: '🧅', text: 'Sai do meu pântano!', source: 'Shrek' },
    { emoji: '🦁', text: 'Hakuna Matata.', source: 'O Rei Leão' },
    { emoji: '🏹', text: 'Que a sorte esteja sempre a seu favor.', source: 'Jogos Vorazes' },
    { emoji: '💊', text: 'Pílula azul ou vermelha? Aqui você tem mais opções.', source: 'Matrix, com licença poética' },
    { emoji: '⚡', text: 'Você é um bruxo, Harry.', source: 'Harry Potter' },
    { emoji: '🐺', text: 'O inverno está chegando.', source: 'Game of Thrones' },
    { emoji: '🧤', text: 'Eu sou inevitável.', source: 'Vingadores: Ultimato' },
    { emoji: '🕷️', text: 'Com grandes poderes vêm grandes responsabilidades. Vote direito.', source: 'Homem-Aranha, mais ou menos' },
    { emoji: '🤖', text: 'Hasta la vista, baby.', source: 'O Exterminador do Futuro 2' },
    { emoji: '👽', text: 'E.T. telefone… minha casa.', source: 'E.T.' },
    { emoji: '🚢', text: 'Eu sou o rei do mundo!', source: 'Titanic' },
    { emoji: '🛋️', text: 'PIVOT! PIVOT! PIVOOOT!', source: 'Friends' },
    { emoji: '🧪', text: 'Eu sou aquele que bate à porta.', source: 'Breaking Bad' },
    { emoji: '🔴', text: 'Temos que pegar!', source: 'Pokémon' },
    { emoji: '🐉', text: 'É mais de 8 mil!', source: 'Dragon Ball Z' },
    { emoji: '📮', text: 'Esse voto aí tá meio sus.', source: 'Among Us' },
    { emoji: '🪖', text: 'Pede pra sair!', source: 'Tropa de Elite' },
    { emoji: '🌵', text: 'Não sei, só sei que foi assim.', source: 'O Auto da Compadecida' },
    { emoji: '🛢️', text: 'Foi sem querer querendo.', source: 'Chaves' },
    { emoji: '🎤', text: 'Ô loco, meu!', source: 'Faustão' },
    { emoji: '💸', text: 'Quem quer dinheiro?', source: 'Silvio Santos' },
    { emoji: '🐠', text: 'Continue a nadar.', source: 'Procurando Nemo' },
    { emoji: '🦖', text: 'A vida encontra um meio.', source: 'Jurassic Park' },
    { emoji: '🥊', text: 'Yo, Adrian!', source: 'Rocky' },
    { emoji: '👻', text: 'Quem você vai chamar?', source: 'Os Caça-Fantasmas' },
    { emoji: '🦇', text: 'Eu sou o Batman.', source: 'Batman' },
  ],
  start: [
    { emoji: '🏹', text: 'Que comecem os jogos.', source: 'Jogos Vorazes' },
    { emoji: '🕶️', text: 'Bem-vindo ao mundo real.', source: 'Matrix' },
    { emoji: '🧙', text: 'Coragem, a jornada começa aqui.', source: 'O Senhor dos Anéis, em espírito' },
  ],
  // Tela de confirmação: a pergunta que ninguém quer ouvir.
  confirm: { emoji: '💰', text: 'Está certo disso?', source: 'Show do Milhão' },
  done: [
    { emoji: '🎯', text: 'Missão dada, parceiro, é missão cumprida.', source: 'Tropa de Elite' },
    { emoji: '🛢️', text: 'Isso, isso, isso!', source: 'Chaves' },
    { emoji: '🏎️', text: 'É teeeetra!', source: 'Galvão Bueno' },
    { emoji: '🕶️', text: 'Hasta la vista, baby.', source: 'O Exterminador do Futuro 2' },
  ],
  already: [
    { emoji: '🧙', text: 'Você não vai passar!', source: 'O Senhor dos Anéis' },
    { emoji: '🛢️', text: 'Ninguém tem paciência comigo!', source: 'Chaves' },
  ],
  closed: [
    { emoji: '🎬', text: 'Acabou, Jéssica!', source: 'meme brasileiro' },
    { emoji: '🎙️', text: 'Errou!', source: 'Faustão' },
  ],
  unavailable: [{ emoji: '🧙', text: 'Um mago nunca se atrasa.', source: 'O Senhor dos Anéis' }],
  notFound: [{ emoji: '🍄', text: 'A princesa está em outro castelo.', source: 'Super Mario Bros.' }],
  // Categoria que cita a Luiza: esta aparece no lugar da sorteada.
  luiza: { emoji: '🍁', text: 'Menos a Luiza, que está no Canadá.', source: 'meme brasileiro' },
  // Modo apresentação.
  suspense: [
    { emoji: '🏆', text: 'E o Oscar vai para…', source: 'Academia de Hollywood' },
    { emoji: '💓', text: 'Haja coração!', source: 'Galvão Bueno' },
    { emoji: '🕵️', text: 'Será que é? Será que não é?', source: 'toda final de reality' },
    { emoji: '💰', text: 'Posso perguntar?', source: 'Show do Milhão' },
    { emoji: '🧤', text: 'Eu sou inevitável.', source: 'Vingadores: Ultimato' },
    { emoji: '🎬', text: 'Luz, câmera, ação!', source: 'todo set de filmagem' },
  ],
  reveal: [
    { emoji: '🎤', text: 'Ô loco, meu!', source: 'Faustão' },
    { emoji: '🏎️', text: 'É teeeetra!', source: 'Galvão Bueno' },
    { emoji: '🛢️', text: 'Isso, isso, isso!', source: 'Chaves' },
    { emoji: '🚢', text: 'Eu sou o rei do mundo!', source: 'Titanic' },
    { emoji: '💎', text: 'Perfeitamente equilibrado, como todas as coisas devem ser.', source: 'Vingadores: Guerra Infinita' },
    { emoji: '🐺', text: 'O Norte não esquece.', source: 'Game of Thrones' },
  ],
};

export function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Baralho: entrega itens em ordem aleatória e só repete depois de usar todos. */
export function deck(list) {
  let pool = [];
  return () => {
    if (!pool.length) pool = shuffled(list);
    return pool.pop();
  };
}

export const pickQuip = (name) => shuffled(QUIPS[name])[0];

export const pickEmojis = (count) => shuffled([...new Set(QUIPS.general.map((q) => q.emoji))]).slice(0, count);

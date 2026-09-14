/**
 * Academy content — interactive lessons. Every `move` step's accepted UCIs
 * are machine-validated for legality (and mate outcomes where declared) by
 * tests/unit/content.test.ts.
 */

export type Track = 'basics' | 'tactics' | 'patterns';

export interface ReadStep {
  kind: 'read';
  fen?: string;
  ar: string;
  en: string;
}

export interface MoveStep {
  kind: 'move';
  fen: string;
  accept: string[]; // legal UCIs accepted as the solution
  goal?: 'mate';
  ar: string;
  en: string;
}

export type LessonStep = ReadStep | MoveStep;

export interface Lesson {
  id: string;
  track: Track;
  order: number; // 1-based, global order of unlocking
  arTitle: string;
  enTitle: string;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'basics-1', track: 'basics', order: 1,
    arTitle: 'الرقعة والقطع', enTitle: 'The board and the pieces',
    steps: [
      {
        kind: 'read', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        ar: 'الشطرنج يُلعب على رقعة 8×8. لكل لاعب 16 قطعة: 8 بيادق، فرسان، أسقفان، رخان، ملكة، وملك. الهدف إنهاء ملك الخصم بالكش مات.',
        en: 'Chess is played on an 8x8 board. Each player has 16 pieces: 8 pawns, 2 knights, 2 bishops, 2 rooks, a queen and a king. The goal: checkmate the enemy king.'
      }
    ]
  },
  {
    id: 'basics-2', track: 'basics', order: 2,
    arTitle: 'البيدق', enTitle: 'The pawn',
    steps: [
      {
        kind: 'move', fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', accept: ['e2e4', 'e2e3'],
        ar: 'البيدق يتقدم خانة واحدة، أو خانتين من موضع البداية، ويأسر قطريًا فقط. حرّك بيدق الملك.',
        en: 'Pawns move one square forward, or two from their start, and capture diagonally. Advance the king pawn.'
      }
    ]
  },
  {
    id: 'basics-3', track: 'basics', order: 3,
    arTitle: 'الفارس', enTitle: 'The knight',
    steps: [
      {
        kind: 'move', fen: '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1', accept: ['g1f3', 'g1h3', 'g1e2'],
        ar: 'الفارس يتحرك على شكل حرف L: خانتان في اتجاه ثم خانة عمودية عليها — وهو الوحيد الذي يقفز فوق القطع. انقل الفارس من g1.',
        en: 'The knight moves in an L-shape: two squares one way, then one sideways — the only piece that jumps over others. Move the knight from g1.'
      }
    ]
  },
  {
    id: 'basics-4', track: 'basics', order: 4,
    arTitle: 'الأسقف والرخ', enTitle: 'Bishop & rook',
    steps: [
      {
        kind: 'move', fen: '4k3/8/8/8/8/8/8/4KB2 w - - 0 1', accept: ['f1c4', 'f1b5', 'f1a6'],
        ar: 'الأسقف ينزلق قطريًا فقط، والرخ في الصفوف والأعمدة فقط. انقل الأسقف عبر القطر الطويل.',
        en: 'Bishops slide only diagonally; rooks only along ranks and files. Move the bishop up the long diagonal.'
      }
    ]
  },
  {
    id: 'basics-5', track: 'basics', order: 5,
    arTitle: 'الملكة', enTitle: 'The queen',
    steps: [
      {
        kind: 'move', fen: '4k3/8/8/8/8/8/8/4K2Q w - - 0 1', accept: ['h1h8', 'h1h6'],
        ar: 'الملكة أقوى قطعة: تنزلق في كل الاتجاهات الثمانية. أطلقها عبر العمود إلى الطرف الآخر.',
        en: 'The queen is the strongest piece: she slides in all eight directions. Launch her up the file to the far side.'
      }
    ]
  },
  {
    id: 'basics-6', track: 'basics', order: 6,
    arTitle: 'الملك والكش', enTitle: 'King & check',
    steps: [
      {
        kind: 'move', fen: '4k3/8/8/8/8/8/8/R5K1 w - - 0 1', accept: ['a1a8'],
        ar: 'الملك يتحرك خانة واحدة في أي اتجاه، ولا يجوز تعريضه للأسر. عندما يهاجمه قطع يكون في "كش" ويجب الرد فورًا. اشهر الكش بالرخ.',
        en: 'The king moves one square any direction and may never be left attacked. When attacked he is "in check" and it must be answered at once. Give check with the rook.'
      }
    ]
  },
  {
    id: 'basics-7', track: 'basics', order: 7,
    arTitle: 'التبييت', enTitle: 'Castling',
    steps: [
      {
        kind: 'move', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1', accept: ['e1g1'],
        ar: 'التبييت مرة واحدة في المباراة: الملك خانتين نحو الرخ والرخ يقفز للجهة الأخرى — بشرط عدم الحركة المسبقة وعدم المرور بخانة مهددة. قم بالتبييت القصير.',
        en: 'Castling happens once per game: the king slides two squares toward a rook and the rook jumps to the other side — only if neither moved and no square crossed is attacked. Castle short.'
      }
    ]
  },
  {
    id: 'basics-8', track: 'basics', order: 8,
    arTitle: 'الترقية والتجاوز', enTitle: 'Promotion & en passant',
    steps: [
      {
        kind: 'move', fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1', accept: ['a7a8q'],
        ar: 'البيدق الذي يبلغ الصف الأخير يترقى — عادةً إلى ملكة. رقِّ البيدق إلى ملكة.',
        en: 'A pawn reaching the last rank promotes — usually to a queen. Promote this pawn to a queen.'
      },
      {
        kind: 'move', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', accept: ['e5d6'],
        ar: 'الأسر بالتجاوز: عندما يتقدم الخصم بيدقه خانتين بجوار بيدقك، يمكنك أسره قطريًا كأنه تقدم خانة واحدة فقط. نفّذ الأسر بالتجاوز e5xd6.',
        en: 'En passant: when the enemy pawn advances two squares beside yours, you may capture it diagonally as if it had moved only one. Play the en passant capture e5xd6.'
      }
    ]
  },
  {
    id: 'tactics-1', track: 'tactics', order: 9,
    arTitle: 'الشوكة', enTitle: 'The fork',
    steps: [
      {
        kind: 'move', fen: '4k3/3q4/8/8/6N1/8/8/4K3 w - - 0 1', accept: ['g4f6'],
        ar: 'الشوكة: قطعة تهاجم هدفين معًا. الفارس أستاذ الشوك — انقل الفارس ليشوّك الملكة والملك في آن واحد.',
        en: 'A fork attacks two targets at once. Knights are the fork masters — move the knight to fork king and queen simultaneously.'
      }
    ]
  },
  {
    id: 'tactics-2', track: 'tactics', order: 10,
    arTitle: 'التسمير', enTitle: 'The pin',
    steps: [
      {
        kind: 'move', fen: '4k3/7q/8/8/4n3/8/8/4KB2 w - - 0 1', accept: ['f1d3'],
        ar: 'التسمير: قطعة لا تستطيع الحركة لأن الأغلى منها خلفها على نفس الخط. سمّر الفارس أمام الملكة بالأسقف.',
        en: 'A pin freezes a piece because something more valuable stands behind it on the same line. Pin the knight against the queen with your bishop.'
      }
    ]
  },
  {
    id: 'tactics-3', track: 'tactics', order: 11,
    arTitle: 'المخترقة (سكيوير)', enTitle: 'The skewer',
    steps: [
      {
        kind: 'move', fen: '3b4/8/8/8/3k4/8/8/2R2K2 w - - 0 1', accept: ['c1d1'],
        ar: 'المخترقى عكس التسمير: الكش على الملك ليبتعد فتُكسب القطعة خلفه. اشهر الكش بالرخ لتربح الأسقف.',
        en: 'A skewer is a reversed pin: check the king so it steps away and you win the piece behind. Check with the rook to win the bishop.'
      }
    ]
  },
  {
    id: 'tactics-4', track: 'tactics', order: 12,
    arTitle: 'الهجوم المكشوف', enTitle: 'Discovered attack',
    steps: [
      {
        kind: 'move', fen: 'q7/1k6/8/3N4/8/8/6B1/6K1 w - - 0 1', accept: ['d5c7', 'd5b6'],
        ar: 'الهجوم المكشوف: تحرك قطعة فتنكشف هجمة قطعة أخرى خلفها — والأجمل أن يمنح الفارس كشًا في نفس الوقت ويضرب الملكة.',
        en: 'A discovered attack: move one piece and unleash the piece behind it — best when the knight gives check at the same time while hitting the queen.'
      }
    ]
  },
  {
    id: 'patterns-1', track: 'patterns', order: 13,
    arTitle: 'مات الصف الأخير', enTitle: 'Back-rank mate',
    steps: [
      {
        kind: 'move', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', accept: [], goal: 'mate',
        ar: 'أشهر أنماط المات: الملك خلف بيادقه والصف الأخير خالٍ. أنزل بالرخ إلى الصف الثامن — كش مات!',
        en: 'The classic pattern: a king sheltered by its pawns with an empty back rank. Slam the rook to the eighth — checkmate!'
      }
    ]
  },
  {
    id: 'patterns-2', track: 'patterns', order: 14,
    arTitle: 'مات الملكة المحمية', enTitle: 'Protected queen mate',
    steps: [
      {
        kind: 'move', fen: '7k/8/6QK/8/8/8/8/8 w - - 0 1', accept: [], goal: 'mate',
        ar: 'الملكة وحدها لا تستطيع المات — تحتاج حماية. أدخل الملكة للملك المحاصر بجوار ملكك الحامي.',
        en: 'A lone queen cannot mate — she needs protection. March her next to the trapped king, guarded by your own king.'
      }
    ]
  },
  {
    id: 'patterns-3', track: 'patterns', order: 15,
    arTitle: 'مات الخنق', enTitle: 'Smothered mate',
    steps: [
      {
        kind: 'move', fen: '6rk/6pp/7N/8/8/8/8/K7 w - - 0 1', accept: [], goal: 'mate',
        ar: 'مات الخنق: قطع الملك نفسه تخنقه، والفارس وحده من يستطيع قفزة المات. قفز الفارس إلى f7!',
        en: 'Smothered mate: the king suffocates behind his own pieces, and only a knight can jump in for mate. Knight to f7!'
      }
    ]
  },
  {
    id: 'patterns-4', track: 'patterns', order: 16,
    arTitle: 'مات السلم بالرخين', enTitle: 'Rook ladder mate',
    steps: [
      {
        kind: 'move', fen: '7k/R7/8/8/8/8/8/1R4K1 w - - 0 1', accept: [], goal: 'mate',
        ar: 'رخان يصنعان سلمًا: أحدهما يقص الصف والآخر يدفع — أنهِ المباراة بالرخ في الصف الثامن.',
        en: 'Two rooks make a ladder: one cuts off the rank while the other pushes. Finish the game with the rook to the eighth.'
      }
    ]
  }
];

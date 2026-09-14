/** Academy screen — interactive lessons with sequential unlocking. */
import { Position, uciToMove, moveToUci } from '../../chess';
import { mateInMoves } from '../../chess/solver';
import { LESSONS, Lesson, LessonStep } from '../../academy/lessons';
import { BoardView } from '../components/board';
import { state, bridge, el, toast, emit } from '../state';
import { sounds } from '../../audio/synth';

const TRACKS: Array<{ id: 'basics' | 'tactics' | 'patterns'; key: string; icon: string }> = [
  { id: 'basics', key: 'academy.trackBasics', icon: '♙' },
  { id: 'tactics', key: 'academy.trackTactics', icon: '♘' },
  { id: 'patterns', key: 'academy.trackPatterns', icon: '♛' }
];

let completed = new Set<string>();

export async function renderAcademy(container: HTMLElement): Promise<void> {
  container.innerHTML = '';
  const t = state.t;
  const prog = await bridge.progress.get();
  completed = new Set(prog.completedLessons);

  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', t('academy.title')));
  head.appendChild(el('div', 'sub', `${t('academy.subtitle')} — ${t('academy.lessonScore')}: ${completed.size}/${LESSONS.length}`));
  container.appendChild(head);

  for (const track of TRACKS) {
    const th = el('div', 'track-h', `${track.icon} ${t(track.key)}`);
    container.appendChild(th);
    const grid = el('div', 'lesson-grid');
    for (const lesson of LESSONS.filter(l => l.track === track.id)) {
      const unlocked = lesson.order === 1 || completed.has(LESSONS.find(l => l.order === lesson.order - 1)!.id);
      const card = el('div', `card lesson-card${unlocked ? '' : ' locked'}`);
      card.appendChild(el('div', 'ttl', `${lesson.order}. ${state.lang === 'ar' ? lesson.arTitle : lesson.enTitle}`));
      const meta = el('div', 'meta');
      const done = completed.has(lesson.id);
      const badge = el('span', `chip ${done ? 'gold' : ''}`, done ? t('academy.completed') : unlocked ? `${lesson.steps.length} ♟` : t('academy.locked'));
      meta.appendChild(badge);
      card.appendChild(meta);
      if (unlocked) {
        card.addEventListener('click', () => runLesson(container, lesson));
      }
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }
}

function runLesson(root: HTMLElement, lesson: Lesson): void {
  const t = state.t;
  root.innerHTML = '';
  const head = el('div', 'page-head');
  head.appendChild(el('h1', '', state.lang === 'ar' ? lesson.arTitle : lesson.enTitle));
  root.appendChild(head);

  let stepIdx = 0;
  const grid = el('div', 'play-grid');
  const boardCol = el('div');
  const side = el('div', 'side-panel');
  const textCard = el('div', 'card');
  const fb = el('div', 'feedback');
  const board = new BoardView(boardCol);
  grid.append(boardCol, side);
  side.append(textCard, fb);
  root.appendChild(grid);

  const backBtn = el('button', 'btn ghost', t('academy.back')) as HTMLButtonElement;
  backBtn.addEventListener('click', () => void renderAcademy(root));
  side.appendChild(backBtn);

  function showStep(): void {
    const step = lesson.steps[stepIdx];
    const stepLabel = el('div', 'chip', `${stepIdx + 1} / ${lesson.steps.length}`);
    stepLabel.style.marginBottom = '10px';
    textCard.innerHTML = '';
    textCard.append(stepLabel, el('p', '', state.lang === 'ar' ? step.ar : step.en));
    fb.className = 'feedback';
    fb.textContent = '';
    if (step.kind === 'read') {
      const nextB = el('button', 'btn primary', stepIdx === lesson.steps.length - 1 ? t('academy.finish') : t('academy.next')) as HTMLButtonElement;
      nextB.style.marginTop = '12px';
      nextB.addEventListener('click', () => advance());
      textCard.appendChild(nextB);
      if (step.fen) board.setPosition(Position.fromFEN(step.fen), { interactive: false, flipped: state.settings.boardFlipped, showCoords: state.settings.showCoordinates });
    } else {
      board.setPosition(Position.fromFEN(step.fen), {
        interactive: true,
        flipped: state.settings.boardFlipped,
        showLegal: state.settings.showLegalMoves,
        showCoords: state.settings.showCoordinates,
        onUserMove: uci => handleMove(step, uci)
      });
    }
  }

  function handleMove(step: LessonStep & { kind: 'move' }, uci: string): void {
    if (step.kind !== 'move') return;
    let ok = false;
    if (step.goal === 'mate') {
      const pos = Position.fromFEN(step.fen);
      const sols = mateInMoves(pos, 1).map(moveToUci);
      ok = sols.includes(uci);
    } else {
      ok = step.accept.includes(uci);
    }
    if (!ok) {
      sounds.wrong();
      fb.className = 'feedback err';
      fb.textContent = t('academy.tryAgain');
      board.setPosition(Position.fromFEN(step.fen), {
        interactive: true, flipped: state.settings.boardFlipped,
        showLegal: state.settings.showLegalMoves, showCoords: state.settings.showCoordinates,
        onUserMove: u => handleMove(step, u)
      });
      return;
    }
    sounds.correct();
    // visualize the move
    const pos = Position.fromFEN(step.fen);
    const m = uciToMove(pos, uci)!;
    pos.make(m);
    board.setPosition(pos, { interactive: false, flipped: state.settings.boardFlipped, showCoords: state.settings.showCoordinates });
    board.setLastMove(m.from, m.to);
    fb.className = 'feedback ok';
    fb.textContent = t('academy.wellDone');
    setTimeout(() => advance(), 700);
  }

  async function advance(): Promise<void> {
    stepIdx++;
    if (stepIdx < lesson.steps.length) { showStep(); return; }
    const wasNew = !completed.has(lesson.id);
    completed.add(lesson.id);
    if (wasNew) {
      await bridge.progress.lessonCompleted({ lessonId: lesson.id });
      emit('progress:changed');
      sounds.unlock();
    }
    toast(t('academy.wellDone'), 'gold');
    await renderAcademy(root);
  }

  showStep();
}

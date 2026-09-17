// 라운드 통계 계산
//
// 여기 있는 '잃은 타수 분해'는 golf-round-analysis 스킬의 1단계와 같은 알고리즘이다.
// 한쪽을 고치면 반드시 다른 쪽도 같이 고친다. 두 곳의 숫자가 다르면 안 된다.
//
// 앱은 계산만 한다. 목표 대비 진단과 조언은 스킬이 맡는다.

const PEN_LOSS = { ob: 2, hazard: 1, unplayable: 1 };
const PEN_NAME = { ob: 'OB', hazard: '해저드', unplayable: '언플레이어블' };

function penKey(hole) {
  return typeof hole.penalty === 'string' ? hole.penalty : null;
}

// 입력이 끝난 홀만 계산에 넣는다
function isDone(h) {
  return h.strokes != null && h.putts != null && h.par;
}

// 그린 적중: 타수에서 퍼트를 뺀 값이 파-2 이하
function isGir(h) {
  return (h.strokes - h.putts) <= (h.par - 2);
}

function roundStats(round) {
  const holes = round.holes;
  const s = {
    played: 0, strokes: 0, par: 0, over: 0, putts: 0,
    gir: 0, girHoles: [],
    scrChance: 0, scrOk: 0,
    girPuttTotal: 0, girPuttAvg: null,
    threeAll: 0, threeGir: 0, threeNonGir: 0,
    penHoles: [], penLoss: 0,
    loss: { 퍼팅: 0, 벌타: 0, 그린미스: 0, 원인불명: 0, 만회: 0 },
    lossHoles: { 퍼팅: [], 벌타: [], 그린미스: [], 원인불명: [], 만회: [] },
  };

  holes.forEach((h, i) => {
    if (!isDone(h)) return;
    const no = i + 1;
    s.played++;
    s.strokes += h.strokes;
    s.par += h.par;
    s.putts += h.putts;

    const gir = isGir(h);
    if (gir) {
      s.gir++;
      s.girHoles.push(no);
      s.girPuttTotal += h.putts;
    } else {
      s.scrChance++;
      if (h.strokes <= h.par) s.scrOk++;
    }

    if (h.putts >= 3) {
      s.threeAll++;
      if (gir) s.threeGir++; else s.threeNonGir++;
    }

    const pen = penKey(h);
    if (pen) {
      s.penHoles.push({ hole: no, key: pen, name: PEN_NAME[pen] });
      s.penLoss += PEN_LOSS[pen];
    }

    // --- 잃은 타수 분해 ---
    let left = h.strokes - h.par;
    if (left < 0) {
      s.loss.만회 += -left;
      s.lossHoles.만회.push(no);
      return;
    }
    if (left === 0) return;

    if (h.putts >= 3) {
      const x = Math.min(left, h.putts - 2);
      if (x > 0) { s.loss.퍼팅 += x; s.lossHoles.퍼팅.push(no); left -= x; }
    }
    if (pen) {
      const x = Math.min(left, PEN_LOSS[pen]);
      if (x > 0) { s.loss.벌타 += x; s.lossHoles.벌타.push(no); left -= x; }
    }
    if (!gir) {
      const x = Math.min(left, 1);
      if (x > 0) { s.loss.그린미스 += x; s.lossHoles.그린미스.push(no); left -= x; }
    }
    if (left > 0) { s.loss.원인불명 += left; s.lossHoles.원인불명.push(no); }
  });

  s.over = s.strokes - s.par;
  s.girPuttAvg = s.gir > 0 ? s.girPuttTotal / s.gir : null;
  s.scrRate = s.scrChance > 0 ? s.scrOk / s.scrChance : null;
  s.lossTotal = s.loss.퍼팅 + s.loss.벌타 + s.loss.그린미스 + s.loss.원인불명;
  s.unknownRatio = s.lossTotal > 0 ? s.loss.원인불명 / s.lossTotal : 0;
  // 검산: 분해 합에서 만회를 빼면 오버파와 같아야 한다
  s.checksum = (s.lossTotal - s.loss.만회) === s.over;
  return s;
}

// 전반/후반 소계
function sideStats(round, from, to) {
  let strokes = 0, par = 0, played = 0;
  for (let i = from; i < to && i < round.holes.length; i++) {
    const h = round.holes[i];
    if (!isDone(h)) continue;
    strokes += h.strokes; par += h.par; played++;
  }
  return { strokes: strokes, par: par, over: strokes - par, played: played };
}

// --- 분석용 텍스트 ---
// golf-round-analysis 스킬이 읽는 형식. 사람이 눈으로 검산할 수 있게 한 줄에 9홀씩 적는다.

const TEE_CH = { L: 'L', F: 'F', R: 'R' };

function nineLine(holes, from, pick) {
  const out = [];
  for (let i = from; i < from + 9; i++) {
    const h = holes[i];
    out.push(h ? (pick(h) == null ? '-' : String(pick(h))) : '-');
  }
  return out.join(' ');
}

function roundBlock(round) {
  const h = round.holes;
  const two = h.length > 9;
  const line = (pick) => nineLine(h, 0, pick) + (two ? ' | ' + nineLine(h, 9, pick) : '');

  const course = round.front.name + (round.back ? '/' + round.back.name : '');
  const lines = [
    `${round.date} ${round.clubName} ${course}`,
    '파 ' + line((x) => x.par),
    '타 ' + line((x) => x.strokes),
    '퍼 ' + line((x) => x.putts),
  ];

  const pens = h.map((x, i) => (penKey(x) ? `${i + 1}:${PEN_NAME[penKey(x)]}` : null)).filter(Boolean);
  if (pens.length) lines.push('벌 ' + pens.join(' '));

  if (h.some((x) => x.tee)) lines.push('티 ' + line((x) => (x.tee ? TEE_CH[x.tee] : null)));

  if (h.some((x) => !isDone(x))) lines.push('※ 미입력 홀은 - 로 표시');

  return lines.join('\n');
}

// rounds: 최근 순으로 정렬된 배열. 오래된 것부터 적어야 추세를 읽기 쉽다.
function analysisText(rounds) {
  const body = rounds.slice().reverse().map(roundBlock).join('\n\n');
  return '골프 라운드 기록 — 분석 요청\n\n' + body;
}

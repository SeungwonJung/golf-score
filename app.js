// 화면 전환과 각 화면의 그리기를 담당한다.
// 화면은 문자열로 HTML을 만들고, 클릭은 data-act 속성으로 한 곳에서 받는다.

const view = document.getElementById('view');
const topTitle = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const actionBtn = document.getElementById('actionBtn');

let stack = [{ name: 'home', params: {} }];
const screens = {};

function current() {
  return stack[stack.length - 1];
}

function go(name, params) {
  stack.push({ name: name, params: params || {} });
  render();
}

// 뒤로 가되, 특정 화면까지 되돌아간다 (라운드 저장 후 홈으로 등 )
function goRoot(name, params) {
  stack = [{ name: name, params: params || {} }];
  render();
}

function back() {
  if (stack.length > 1) stack.pop();
  render();
}

function render() {
  const { name, params } = current();
  const screen = screens[name];
  if (!screen) {
    view.innerHTML = '<div class="empty">화면을 찾을 수 없습니다</div>';
    return;
  }
  const out = screen(params);
  view.innerHTML = out.html;
  topTitle.textContent = out.title || '골프 스코어';

  backBtn.hidden = stack.length <= 1;
  if (out.action) {
    actionBtn.hidden = false;
    actionBtn.textContent = out.action.label;
    actionBtn.dataset.act = out.action.act;
  } else {
    actionBtn.hidden = true;
    delete actionBtn.dataset.act;
  }

  window.scrollTo(0, 0);
  if (out.after) out.after();
}

backBtn.addEventListener('click', back);

// 클릭 한 곳에서 처리
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-act]');
  if (!target) return;
  const act = target.dataset.act;
  const fn = actions[act];
  if (fn) {
    e.preventDefault();
    fn(target.dataset, target);
  }
});

const actions = {};

// 안드로이드 크롬은 설치할 수 있게 되면 이 이벤트를 준다.
// 기본 안내 배너를 막고 홈 화면에 직접 버튼을 띄운다.
let deferredInstall = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (current().name === 'home') render();
});

window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  if (current().name === 'home') render();
});

actions.installApp = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  render();
};

// --- 도우미 ---

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// 오버파를 +3 / E / -1 형태로
function toPar(diff) {
  if (diff === 0) return 'E';
  return diff > 0 ? '+' + diff : String(diff);
}

function parSum(pars) {
  return pars.reduce((a, p) => a + (p || 0), 0);
}

function courseLabel(course) {
  const known = course.pars.filter((p) => p).length;
  if (known === 0) return '파 배치 미입력';
  if (known < 9) return `파 ${parSum(course.pars)} · ${9 - known}홀 미입력`;
  return `파 ${parSum(course.pars)}`;
}

// --- 홈 ---

screens.home = function () {
  const clubs = getClubs();
  const active = getActiveRound();
  const rounds = getRounds().filter((r) => r.finished).slice(0, 5);

  let html = '';

  if (active) {
    const done = active.holes.filter((h) => h.strokes != null).length;
    html += `
      <button class="btn btn-primary btn-lg" data-act="resume" data-id="${active.id}">
        진행 중인 라운드 이어하기
      </button>
      <div class="card mt" style="border-color:var(--green);background:var(--green-soft)">
        <strong>${esc(active.clubName)}</strong>
        <div style="color:var(--ink-2);font-size:15px;margin-top:4px">
          ${esc(active.date)} · ${done}/${active.holes.length}홀 입력됨
        </div>
      </div>
      <button class="btn mt" data-act="newRound">새 라운드 시작</button>
    `;
  } else if (clubs.length === 0) {
    html += `
      <div class="empty">
        먼저 골프장을 등록해 주세요.<br>
        골프장 하나에 9홀 코스를 여러 개 넣습니다.
      </div>
      <button class="btn btn-primary btn-lg" data-act="goClubs">골프장 등록하기</button>
    `;
  } else {
    html += `<button class="btn btn-primary btn-lg" data-act="newRound">라운드 시작</button>`;
  }

  html += `
    <div class="section-label">최근 라운드</div>
    ${rounds.length === 0
      ? '<div class="empty" style="padding:24px 0">아직 기록이 없습니다</div>'
      : '<div class="stack">' + rounds.map(roundListItem).join('') + '</div>'}

    ${deferredInstall ? `
      <button class="btn mt-lg" data-act="installApp" style="border-color:var(--green);color:var(--green)">
        홈 화면에 설치하기
      </button>` : ''}

    <div class="section-label">관리</div>
    <div class="stack">
      <button class="list-item" data-act="goClubs">
        <span class="grow">골프장 · 코스<span class="sub">${clubs.length}곳 등록됨</span></span>
        <span class="chev">›</span>
      </button>
      <button class="list-item" data-act="goSettings">
        <span class="grow">백업 · 내보내기</span>
        <span class="chev">›</span>
      </button>
    </div>
  `;

  return { title: '골프 스코어', html: html };
};

function roundListItem(r) {
  const total = r.holes.reduce((a, h) => a + (h.strokes || 0), 0);
  const par = parSum(r.holes.map((h) => h.par));
  const played = r.holes.filter((h) => h.strokes != null).length;
  const diff = played === r.holes.length && par ? ` (${toPar(total - par)})` : '';
  return `
    <button class="list-item" data-act="openSummary" data-id="${r.id}">
      <span class="grow">${esc(r.clubName)}
        <span class="sub">${esc(r.date)} · ${esc(r.front.name)}${r.back ? ' → ' + esc(r.back.name) : ''}</span>
      </span>
      <strong style="font-size:22px">${total}</strong>
      <span style="color:var(--ink-2);font-size:14px">${diff}</span>
    </button>
  `;
}

actions.goClubs = () => go('clubs');
actions.goSettings = () => go('settings');
actions.newRound = () => go('newRound');
actions.resume = (d) => go('play', { roundId: d.id });
actions.openSummary = (d) => go('summary', { roundId: d.id });

// --- 골프장 목록 ---

screens.clubs = function () {
  const clubs = getClubs();
  const html = `
    <div class="row">
      <input type="text" id="newClubName" placeholder="골프장 이름" autocomplete="off">
      <button class="btn btn-inline" data-act="addClub">추가</button>
    </div>
    ${clubs.length === 0
      ? `<div class="empty">등록된 골프장이 없습니다.<br>이름을 넣고 추가를 누르세요.</div>`
      : `<div class="stack mt">` + clubs.map((c) => `
          <button class="list-item" data-act="openClub" data-id="${c.id}">
            <span class="grow">${esc(c.name)}
              <span class="sub">${c.courses.length === 0 ? '코스 없음' : c.courses.map((x) => esc(x.name)).join(' · ')}</span>
            </span>
            <span class="chev">›</span>
          </button>`).join('') + `</div>`}
  `;
  return { title: '골프장', html: html };
};

actions.addClub = () => {
  const input = document.getElementById('newClubName');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  const club = addClub(name);
  go('club', { clubId: club.id });
};

actions.openClub = (d) => go('club', { clubId: d.clubId || d.id });

// --- 골프장 상세: 9홀 코스 목록 ---

screens.club = function (params) {
  const club = getClub(params.clubId);
  if (!club) return { title: '골프장', html: '<div class="empty">삭제된 골프장입니다</div>' };

  const html = `
    <div class="row">
      <input type="text" id="newCourseName" placeholder="9홀 코스 이름 (예: 남코스)" autocomplete="off">
      <button class="btn btn-inline" data-act="addCourse" data-club="${club.id}">추가</button>
    </div>

    ${club.courses.length === 0
      ? `<div class="empty">
           9홀 단위로 코스를 등록합니다.<br>
           18홀짜리 코스는 <strong>크리크 OUT</strong>, <strong>크리크 IN</strong>처럼<br>
           둘로 나눠 넣어주세요.
         </div>`
      : `<div class="stack mt">` + club.courses.map((c) => `
          <button class="list-item" data-act="openCourse" data-club="${club.id}" data-course="${c.id}">
            <span class="grow">${esc(c.name)}<span class="sub">${courseLabel(c)}</span></span>
            <span class="chev">›</span>
          </button>`).join('') + `</div>`}

    <div class="section-label">골프장 설정</div>
    <div class="stack">
      <div class="row">
        <input type="text" id="clubRename" value="${esc(club.name)}" autocomplete="off">
        <button class="btn btn-inline" data-act="renameClub" data-club="${club.id}">변경</button>
      </div>
      <button class="btn btn-danger btn-sm" data-act="deleteClub" data-club="${club.id}">이 골프장 삭제</button>
    </div>
  `;
  return { title: club.name, html: html };
};

actions.addCourse = (d) => {
  const input = document.getElementById('newCourseName');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  const course = addCourse(d.club, name, [4, 4, 4, 4, 4, 4, 4, 4, 4]);
  go('course', { clubId: d.club, courseId: course.id });
};

actions.openCourse = (d) => go('course', { clubId: d.club, courseId: d.course });

actions.renameClub = (d) => {
  const name = document.getElementById('clubRename').value.trim();
  if (!name) return;
  renameClub(d.club, name);
  render();
};

actions.deleteClub = (d) => {
  const club = getClub(d.club);
  if (!club) return;
  if (!confirm(`'${club.name}'을 삭제합니다.\n등록한 코스도 함께 지워집니다. 지난 라운드 기록은 그대로 남습니다.`)) return;
  deleteClub(d.club);
  back();
};

// --- 코스 편집: 9홀 파 배치 ---

let draft = null;

screens.course = function (params) {
  const club = getClub(params.clubId);
  const course = club && club.courses.find((c) => c.id === params.courseId);
  if (!course) return { title: '코스', html: '<div class="empty">삭제된 코스입니다</div>' };

  if (!draft || draft.courseId !== course.id) {
    draft = { courseId: course.id, name: course.name, pars: course.pars.slice() };
  }

  const rows = draft.pars.map((p, i) => `
    <div class="par-row">
      <span class="par-no">${i + 1}</span>
      ${[3, 4, 5].map((v) => `
        <button class="par-btn${p === v ? ' selected' : ''}" data-act="setPar" data-i="${i}" data-p="${v}">${v}</button>
      `).join('')}
      <button class="par-btn${p == null ? ' selected' : ''}" data-act="setPar" data-i="${i}" data-p="">?</button>
    </div>
  `).join('');

  const known = draft.pars.filter((p) => p).length;

  const html = `
    <input type="text" id="courseName" value="${esc(draft.name)}" placeholder="코스 이름" autocomplete="off">

    <div class="section-label">홀별 파 · 모르면 ?로 두고 라운드 중에 정해도 됩니다</div>
    ${rows}

    <div class="card mt" style="text-align:center">
      <strong style="font-size:20px">합계 ${parSum(draft.pars)}</strong>
      <span style="color:var(--ink-2);font-size:15px"> · ${known}/9홀 입력</span>
    </div>

    <div class="stack mt">
      <button class="btn btn-primary" data-act="saveCourse" data-club="${params.clubId}" data-course="${course.id}">저장</button>
      <button class="btn btn-sm" data-act="parsAllUnknown">전부 ?로 비우기</button>
      <button class="btn btn-danger btn-sm" data-act="deleteCourse" data-club="${params.clubId}" data-course="${course.id}">이 코스 삭제</button>
    </div>
  `;
  return { title: course.name, html: html };
};

actions.setPar = (d) => {
  const name = document.getElementById('courseName');
  if (name) draft.name = name.value;
  draft.pars[Number(d.i)] = d.p === '' ? null : Number(d.p);
  render();
};

actions.parsAllUnknown = () => {
  const name = document.getElementById('courseName');
  if (name) draft.name = name.value;
  draft.pars = [null, null, null, null, null, null, null, null, null];
  render();
};

actions.saveCourse = (d) => {
  const name = document.getElementById('courseName').value.trim();
  if (!name) { document.getElementById('courseName').focus(); return; }
  updateCourse(d.club, d.course, name, draft.pars);
  draft = null;
  back();
};

actions.deleteCourse = (d) => {
  if (!confirm('이 코스를 삭제합니다. 지난 라운드 기록은 그대로 남습니다.')) return;
  deleteCourse(d.club, d.course);
  draft = null;
  back();
};

// --- 라운드 시작 ---

let roundDraft = null;

screens.newRound = function () {
  const clubs = getClubs();
  if (clubs.length === 0) {
    return { title: '라운드 시작', html: `
      <div class="empty">먼저 골프장을 등록해 주세요.</div>
      <button class="btn btn-primary" data-act="goClubs">골프장 등록하기</button>` };
  }

  if (!roundDraft) roundDraft = { date: todayString(), clubId: null, frontId: null, backId: null };
  const club = roundDraft.clubId ? clubs.find((c) => c.id === roundDraft.clubId) : null;

  let html = `
    <input type="date" id="roundDate" value="${roundDraft.date}">

    <div class="section-label">골프장</div>
    <div class="stack">
      ${clubs.map((c) => `
        <button class="list-item${roundDraft.clubId === c.id ? ' selected' : ''}" data-act="pickClub" data-id="${c.id}">
          <span class="grow">${esc(c.name)}</span>
        </button>`).join('')}
    </div>
  `;

  if (club) {
    if (club.courses.length === 0) {
      html += `<div class="empty">이 골프장에 등록된 코스가 없습니다.</div>
        <button class="btn" data-act="openClub" data-id="${club.id}">코스 추가하기</button>`;
    } else {
      html += `
        <div class="section-label">전반 9홀</div>
        <div class="stack">
          ${club.courses.map((c) => `
            <button class="list-item${roundDraft.frontId === c.id ? ' selected' : ''}" data-act="pickFront" data-id="${c.id}">
              <span class="grow">${esc(c.name)}<span class="sub">${courseLabel(c)}</span></span>
            </button>`).join('')}
        </div>
      `;
      if (roundDraft.frontId) {
        html += `
          <div class="section-label">후반 9홀</div>
          <div class="stack">
            ${club.courses.map((c) => `
              <button class="list-item${roundDraft.backId === c.id ? ' selected' : ''}" data-act="pickBack" data-id="${c.id}">
                <span class="grow">${esc(c.name)}<span class="sub">${courseLabel(c)}</span></span>
              </button>`).join('')}
            <button class="list-item${roundDraft.backId === 'none' ? ' selected' : ''}" data-act="pickBack" data-id="none">
              <span class="grow">후반 없이 9홀만</span>
            </button>
          </div>
        `;
      }
    }
  }

  const ready = roundDraft.frontId && roundDraft.backId;
  html += `<div class="mt-lg"><button class="btn btn-primary btn-lg" data-act="startRound" ${ready ? '' : 'disabled'}>라운드 시작</button></div>`;

  return { title: '라운드 시작', html: html };
};

function syncDraftDate() {
  const d = document.getElementById('roundDate');
  if (d && d.value) roundDraft.date = d.value;
}

actions.pickClub = (d) => {
  syncDraftDate();
  roundDraft.clubId = d.id;
  roundDraft.frontId = null;
  roundDraft.backId = null;
  render();
};

actions.pickFront = (d) => {
  syncDraftDate();
  roundDraft.frontId = d.id;
  roundDraft.backId = null;
  render();
};

actions.pickBack = (d) => {
  syncDraftDate();
  roundDraft.backId = d.id;
  render();
};

actions.startRound = () => {
  syncDraftDate();
  const round = createRound({
    clubId: roundDraft.clubId,
    frontCourseId: roundDraft.frontId,
    backCourseId: roundDraft.backId === 'none' ? null : roundDraft.backId,
    date: roundDraft.date,
  });
  if (!round) return;
  roundDraft = null;
  goRoot('play', { roundId: round.id });
};

// --- 홀 입력 ---

let moreStrokes = false;
let morePutts = false;
let showOptional = false;
let advanceTimer = null;

function scoreName(strokes, par) {
  if (!par) return String(strokes);
  const d = strokes - par;
  if (strokes === 1) return '홀인원';
  if (d <= -3) return '앨버트로스';
  if (d === -2) return '이글';
  if (d === -1) return '버디';
  if (d === 0) return '파';
  if (d === 1) return '보기';
  if (d === 2) return '더블';
  if (d === 3) return '트리플';
  return '+' + d;
}

// 지금까지 입력된 홀만으로 누적 오버파를 센다
function runningDiff(round) {
  let diff = 0;
  round.holes.forEach((h) => {
    if (h.strokes != null && h.par) diff += h.strokes - h.par;
  });
  return diff;
}

function holeCourseName(round, i) {
  return i < 9 ? round.front.name : (round.back ? round.back.name : round.front.name);
}

screens.play = function (params) {
  const round = getRound(params.roundId);
  if (!round) return { title: '라운드', html: '<div class="empty">삭제된 라운드입니다</div>' };

  const i = round.currentHole;
  const hole = round.holes[i];
  const last = round.holes.length - 1;
  const diff = runningDiff(round);

  let html = `
    <div class="play-wrap"><div class="play-main">
    <div class="play-head">
      <span>${esc(holeCourseName(round, i))}</span>
      <span>${i + 1} / ${round.holes.length}</span>
    </div>
    <div class="hole-bar">
      <div class="hole-no">${i + 1}<span class="hole-par">${hole.par ? '파 ' + hole.par : '파 미정'}</span></div>
      <div class="hole-total">
        <span class="lab">누적</span>
        <strong class="${diff > 0 ? 'over' : diff < 0 ? 'under' : ''}">${toPar(diff)}</strong>
      </div>
    </div>
  `;

  if (!hole.par) {
    html += `
      <div class="field-label">이 홀의 파</div>
      <div class="score-grid">
        ${[3, 4, 5].map((p) => `<button class="score-btn" data-act="setHolePar" data-p="${p}"><b>${p}</b></button>`).join('')}
      </div>
      <div class="hint">티박스 표지판을 보고 눌러주세요. 코스 설정에도 저장됩니다.</div>
    </div></div>`;
    return { title: round.clubName, html: html, after: keepAwake };
  }

  // 타수
  const par = hole.par;
  const main = [par - 1, par, par + 1, par + 2];
  html += `
    <div class="play-spacer"></div>
    <div class="field-label">타수</div>
    <div class="score-grid">
      ${main.map((s) => `
        <button class="score-btn${hole.strokes === s ? ' selected' : ''}" data-act="setStrokes" data-s="${s}">
          <b>${s}</b><span>${scoreName(s, par)}</span>
        </button>`).join('')}
    </div>
    <button class="more-btn" data-act="toggleMoreStrokes">${moreStrokes ? '접기' : '그 외 타수'}</button>
    ${moreStrokes ? `<div class="score-grid wrap">
      ${otherStrokes(par).map((s) => `
        <button class="score-btn sm${hole.strokes === s ? ' selected' : ''}" data-act="setStrokes" data-s="${s}">
          <b>${s}</b><span>${scoreName(s, par)}</span>
        </button>`).join('')}
    </div>` : ''}
  `;

  // 퍼트
  const maxPutts = hole.strokes != null ? hole.strokes : 9;
  html += `
    <div class="field-label">퍼트</div>
    <div class="score-grid">
      ${[0, 1, 2, 3].map((p) => `
        <button class="score-btn${hole.putts === p ? ' selected' : ''}" data-act="setPutts" data-p="${p}" ${p > maxPutts ? 'disabled' : ''}>
          <b>${p}</b>
        </button>`).join('')}
    </div>
    <button class="more-btn" data-act="toggleMorePutts">${morePutts ? '접기' : '4퍼트 이상'}</button>
    ${morePutts ? `<div class="score-grid">
      ${[4, 5, 6, 7].map((p) => `
        <button class="score-btn sm${hole.putts === p ? ' selected' : ''}" data-act="setPutts" data-p="${p}" ${p > maxPutts ? 'disabled' : ''}>
          <b>${p}</b>
        </button>`).join('')}
    </div>` : ''}
  `;

  // 선택 입력 (평소엔 접혀 있다)
  const optionalMark = (hole.tee ? '●' : '') + (hole.penalty ? '▲' : '');
  html += `
    <button class="more-btn" data-act="toggleOptional">
      ${showOptional ? '접기' : '티샷 · 벌타 기록'} ${optionalMark ? '<span class="mark">' + optionalMark + '</span>' : ''}
    </button>
    ${showOptional ? `
      <div class="field-label">티샷</div>
      <div class="score-grid">
        ${[['L', '왼쪽'], ['F', '페어웨이'], ['R', '오른쪽']].map(([v, lab]) => `
          <button class="score-btn sm${hole.tee === v ? ' selected' : ''}" data-act="setTee" data-v="${v}"><span>${lab}</span></button>`).join('')}
      </div>
      <div class="field-label">벌타</div>
      <div class="score-grid">
        ${[0, 1, 2].map((v) => `
          <button class="score-btn sm${(hole.penalty || 0) === v ? ' selected' : ''}" data-act="setPenalty" data-v="${v}"><b>${v}</b></button>`).join('')}
      </div>
    ` : ''}
  `;

  // 하단 이동
  html += `
    <div class="nav-bar">
      <button class="nav-btn" data-act="prevHole" ${i === 0 ? 'disabled' : ''}>‹ 이전</button>
      <button class="nav-btn" data-act="clearHole">지우기</button>
      ${i === last
        ? `<button class="nav-btn done" data-act="finishRound">라운드 종료</button>`
        : `<button class="nav-btn" data-act="nextHole">다음 ›</button>`}
    </div>
    <button class="more-btn mt card-link" data-act="openCard">스코어카드 보기</button>
    </div>
    <aside class="play-side">
      ${cardTable(round, 0, 9, round.front.name)}
      ${round.back ? cardTable(round, 9, 18, round.back.name) : ''}
    </aside>
    </div>
  `;

  return { title: round.clubName, html: html, after: keepAwake };
};

function otherStrokes(par) {
  const out = [];
  for (let s = Math.max(1, par - 3); s <= par + 7; s++) {
    if (s < par - 1 || s > par + 2) out.push(s);
  }
  return out;
}

function resetHoleUI() {
  moreStrokes = false;
  morePutts = false;
  showOptional = false;
}

// 홀 번호로 어느 코스의 몇 번째 홀인지 찾는다
function holeSlot(round, i) {
  return i < 9
    ? { side: round.front, index: i }
    : { side: round.back, index: i - 9 };
}

actions.setHolePar = (d) => {
  const { roundId } = current().params;
  const round = getRound(roundId);
  const i = round.currentHole;
  const par = Number(d.p);

  // 라운드 기록과 코스 설정 양쪽에 반영한다
  round.holes[i].par = par;
  const slot = holeSlot(round, i);
  if (slot.side) slot.side.pars[slot.index] = par;
  saveRound(round);

  const club = getClub(round.clubId);
  if (club && slot.side) {
    const course = club.courses.find((c) => c.id === slot.side.courseId);
    if (course) {
      const pars = course.pars.slice();
      pars[slot.index] = par;
      updateCourse(club.id, course.id, course.name, pars);
    }
  }
  render();
};

// 타수와 퍼트가 막 둘 다 채워졌으면 다음 홀로 넘긴다
function maybeAdvance(before, after, round) {
  const wasComplete = before.strokes != null && before.putts != null;
  const nowComplete = after.strokes != null && after.putts != null;
  if (wasComplete || !nowComplete) return;
  if (round.currentHole >= round.holes.length - 1) return;

  clearTimeout(advanceTimer);
  const target = round.currentHole;
  advanceTimer = setTimeout(() => {
    const now = current();
    if (now.name !== 'play') return;
    const fresh = getRound(now.params.roundId);
    if (!fresh || fresh.currentHole !== target) return;
    setCurrentHole(fresh.id, target + 1);
    resetHoleUI();
    render();
  }, 350);
}

function setHoleValue(patch) {
  const { roundId } = current().params;
  const round = getRound(roundId);
  const i = round.currentHole;
  const before = Object.assign({}, round.holes[i]);
  Object.assign(round.holes[i], patch);
  saveRound(round);
  render();
  maybeAdvance(before, round.holes[i], round);
}

actions.setStrokes = (d) => {
  const s = Number(d.s);
  const { roundId } = current().params;
  const round = getRound(roundId);
  const hole = round.holes[round.currentHole];
  // 퍼트가 타수보다 많아지면 퍼트를 지운다
  const patch = { strokes: s };
  if (hole.putts != null && hole.putts > s) patch.putts = null;
  setHoleValue(patch);
};

actions.setPutts = (d) => setHoleValue({ putts: Number(d.p) });
actions.setTee = (d) => setHoleValue({ tee: d.v });
actions.setPenalty = (d) => setHoleValue({ penalty: Number(d.v) });

actions.toggleMoreStrokes = () => { moreStrokes = !moreStrokes; render(); };
actions.toggleMorePutts = () => { morePutts = !morePutts; render(); };
actions.toggleOptional = () => { showOptional = !showOptional; render(); };

actions.clearHole = () => {
  clearTimeout(advanceTimer);
  const { roundId } = current().params;
  const round = getRound(roundId);
  const i = round.currentHole;
  Object.assign(round.holes[i], { strokes: null, putts: null, tee: null, penalty: 0 });
  saveRound(round);
  render();
};

actions.prevHole = () => {
  clearTimeout(advanceTimer);
  const { roundId } = current().params;
  const round = getRound(roundId);
  setCurrentHole(roundId, round.currentHole - 1);
  resetHoleUI();
  render();
};

actions.nextHole = () => {
  clearTimeout(advanceTimer);
  const { roundId } = current().params;
  const round = getRound(roundId);
  setCurrentHole(roundId, round.currentHole + 1);
  resetHoleUI();
  render();
};

actions.finishRound = () => {
  clearTimeout(advanceTimer);
  const { roundId } = current().params;
  const round = getRound(roundId);
  const missing = round.holes.filter((h) => h.strokes == null).length;
  if (missing > 0 && !confirm(`${missing}개 홀이 비어 있습니다. 그래도 끝낼까요?`)) return;
  finishRound(roundId);
  goRoot('summary', { roundId: roundId });
};

actions.openCard = () => go('card', { roundId: current().params.roundId });

// 라운드 중에는 화면이 꺼지지 않게 한다
let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {
    // 지원하지 않는 브라우저면 그냥 넘어간다
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && current().name === 'play') keepAwake();
});

// --- 스코어카드 ---

function sideTotals(round, from, to) {
  let strokes = 0, putts = 0, par = 0, played = 0;
  for (let i = from; i < to && i < round.holes.length; i++) {
    const h = round.holes[i];
    if (h.strokes != null) { strokes += h.strokes; played++; }
    if (h.putts != null) putts += h.putts;
    if (h.par) par += h.par;
  }
  return { strokes, putts, par, played };
}

function cardTable(round, from, to, label) {
  const holes = [];
  for (let i = from; i < to && i < round.holes.length; i++) holes.push(i);
  if (holes.length === 0) return '';
  const t = sideTotals(round, from, to);

  const cell = (v) => (v == null ? '·' : v);
  return `
    <div class="card-title">${esc(label)}</div>
    <table class="scorecard">
      <tr class="hd">
        <th>홀</th>${holes.map((i) => `<th>${i + 1}</th>`).join('')}<th>계</th>
      </tr>
      <tr>
        <th>파</th>${holes.map((i) => `<td>${cell(round.holes[i].par)}</td>`).join('')}<td class="sum">${t.par || '·'}</td>
      </tr>
      <tr class="strokes">
        <th>타수</th>${holes.map((i) => {
          const h = round.holes[i];
          const cls = h.strokes != null && h.par ? scoreClass(h.strokes - h.par) : '';
          return `<td class="${cls}" data-act="jumpHole" data-i="${i}">${cell(h.strokes)}</td>`;
        }).join('')}<td class="sum">${t.strokes || '·'}</td>
      </tr>
      <tr>
        <th>퍼트</th>${holes.map((i) => `<td>${cell(round.holes[i].putts)}</td>`).join('')}<td class="sum">${t.putts || '·'}</td>
      </tr>
    </table>
  `;
}

function scoreClass(d) {
  if (d <= -1) return 'birdie';
  if (d === 0) return 'par';
  if (d === 1) return 'bogey';
  return 'double';
}

screens.card = function (params) {
  const round = getRound(params.roundId);
  if (!round) return { title: '스코어카드', html: '<div class="empty">삭제된 라운드입니다</div>' };
  const html = `
    ${cardTable(round, 0, 9, round.front.name)}
    ${round.back ? cardTable(round, 9, 18, round.back.name) : ''}
    <div class="hint mt">타수 칸을 누르면 그 홀로 이동합니다</div>
  `;
  return { title: '스코어카드', html: html };
};

actions.jumpHole = (d) => {
  const { roundId } = current().params;
  const round = getRound(roundId);
  if (!round || round.finished) return;
  setCurrentHole(roundId, Number(d.i));
  resetHoleUI();
  clearTimeout(advanceTimer);
  // 펼친 화면에서는 스코어카드가 입력 화면 옆에 붙어 있으므로 되돌아갈 곳이 없다
  if (current().name === 'play') render();
  else back();
};

// --- 라운드 결과 ---

screens.summary = function (params) {
  const round = getRound(params.roundId);
  if (!round) return { title: '라운드', html: '<div class="empty">삭제된 라운드입니다</div>' };

  const all = sideTotals(round, 0, round.holes.length);
  const out = sideTotals(round, 0, 9);
  const inn = round.back ? sideTotals(round, 9, 18) : null;
  const diff = all.par ? all.strokes - all.par : null;

  const html = `
    <div class="result-head">
      <div class="result-score">${all.strokes}</div>
      <div class="result-diff ${diff > 0 ? 'over' : diff < 0 ? 'under' : ''}">${diff == null ? '' : toPar(diff)}</div>
    </div>
    <div class="result-sub">
      ${esc(round.clubName)} · ${esc(round.date)}<br>
      ${esc(round.front.name)} ${out.strokes}${inn ? ' → ' + esc(round.back.name) + ' ' + inn.strokes : ''}
      ${all.putts ? ' · 퍼트 ' + all.putts : ''}
    </div>

    ${all.played < round.holes.length
      ? `<div class="warn">${round.holes.length - all.played}개 홀이 비어 있습니다</div>` : ''}

    <div class="mt">
      ${cardTable(round, 0, 9, round.front.name)}
      ${round.back ? cardTable(round, 9, 18, round.back.name) : ''}
    </div>

    <div class="stack mt-lg">
      <button class="btn" data-act="editRound" data-id="${round.id}">기록 수정하기</button>
      <button class="btn" data-act="goHome">홈으로</button>
      <button class="btn btn-danger btn-sm" data-act="deleteRound" data-id="${round.id}">이 라운드 삭제</button>
    </div>
  `;
  return { title: '라운드 결과', html: html };
};

actions.editRound = (d) => {
  reopenRound(d.id);
  resetHoleUI();
  go('play', { roundId: d.id });
};

actions.goHome = () => goRoot('home');

actions.deleteRound = (d) => {
  if (!confirm('이 라운드 기록을 삭제합니다. 되돌릴 수 없습니다.')) return;
  deleteRound(d.id);
  goRoot('home');
};

// --- 백업 ---

screens.settings = function () {
  const db = loadDB();
  const courses = db.clubs.reduce((a, c) => a + c.courses.length, 0);
  const html = `
    <div class="card">
      골프장 ${db.clubs.length}곳 · 코스 ${courses}개 · 라운드 ${db.rounds.length}개
    </div>

    <div class="section-label">내보내기</div>
    <div class="hint" style="text-align:left">코스 설정과 라운드 기록이 모두 들어갑니다. 기기를 바꿀 때 이 내용을 가져오기에 붙여넣으면 그대로 복원됩니다.</div>
    <textarea id="exportBox" readonly>${esc(exportAll())}</textarea>
    <button class="btn mt" data-act="copyExport">전체 복사</button>

    <div class="section-label">가져오기</div>
    <textarea id="importBox" placeholder="내보낸 내용을 여기에 붙여넣으세요"></textarea>
    <div class="row mt">
      <button class="btn" data-act="importMerge">합치기</button>
      <button class="btn btn-danger" data-act="importReplace">전체 덮어쓰기</button>
    </div>
  `;
  return { title: '백업 · 내보내기', html: html };
};

actions.copyExport = async (d, btn) => {
  const box = document.getElementById('exportBox');
  try {
    await navigator.clipboard.writeText(box.value);
  } catch (e) {
    box.select();
    document.execCommand('copy');
  }
  btn.textContent = '복사됨';
  setTimeout(() => { btn.textContent = '전체 복사'; }, 1500);
};

function doImport(mode) {
  const text = document.getElementById('importBox').value.trim();
  if (!text) return;
  try {
    const r = importAll(text, mode);
    alert(`골프장 ${r.clubs}곳, 라운드 ${r.rounds}개를 가져왔습니다.`);
    render();
  } catch (e) {
    alert('가져오지 못했습니다. 내용이 올바른지 확인해 주세요.');
  }
}

actions.importMerge = () => doImport('merge');
actions.importReplace = () => {
  if (!confirm('지금 기기에 있는 모든 기록을 지우고 덮어씁니다. 계속할까요?')) return;
  doImport('replace');
};

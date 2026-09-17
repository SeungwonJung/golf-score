// 데이터 저장 계층
// 브라우저 localStorage에 JSON 한 덩어리로 보관한다.
// 라운드 1개가 약 1KB, localStorage 한도는 약 5MB이므로 수천 라운드까지 여유가 있다.

const STORAGE_KEY = 'golfscore.v1';

const EMPTY_DB = { version: 1, clubs: [], rounds: [] };

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_DB);
    const db = JSON.parse(raw);
    return {
      version: db.version || 1,
      clubs: Array.isArray(db.clubs) ? db.clubs : [],
      rounds: Array.isArray(db.rounds) ? db.rounds : [],
    };
  } catch (e) {
    console.error('저장된 데이터를 읽지 못했습니다', e);
    return structuredClone(EMPTY_DB);
  }
}

function saveDB(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('저장에 실패했습니다', e);
    alert('저장 공간이 부족합니다. 설정에서 오래된 라운드를 내보낸 뒤 지워주세요.');
    return false;
  }
}

// --- 골프장 ---

function getClubs() {
  return loadDB().clubs;
}

function getClub(clubId) {
  return loadDB().clubs.find((c) => c.id === clubId) || null;
}

function addClub(name) {
  const db = loadDB();
  const club = { id: newId(), name: name.trim(), courses: [] };
  db.clubs.push(club);
  saveDB(db);
  return club;
}

function renameClub(clubId, name) {
  const db = loadDB();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) return false;
  club.name = name.trim();
  saveDB(db);
  return true;
}

function deleteClub(clubId) {
  const db = loadDB();
  db.clubs = db.clubs.filter((c) => c.id !== clubId);
  saveDB(db);
}

// --- 9홀 코스 ---
// pars는 길이 9 배열. 아직 모르는 홀은 null로 두고 라운드 중에 채운다.

function addCourse(clubId, name, pars) {
  const db = loadDB();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) return null;
  const course = { id: newId(), name: name.trim(), pars: normalizePars(pars) };
  club.courses.push(course);
  saveDB(db);
  return course;
}

function updateCourse(clubId, courseId, name, pars) {
  const db = loadDB();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) return false;
  const course = club.courses.find((c) => c.id === courseId);
  if (!course) return false;
  course.name = name.trim();
  course.pars = normalizePars(pars);
  saveDB(db);
  return true;
}

function deleteCourse(clubId, courseId) {
  const db = loadDB();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) return;
  club.courses = club.courses.filter((c) => c.id !== courseId);
  saveDB(db);
}

// 길이 9를 보장하고, 파가 아닌 값은 null(모름)로 바꾼다
function normalizePars(pars) {
  const out = [];
  for (let i = 0; i < 9; i++) {
    const v = Array.isArray(pars) ? pars[i] : null;
    out.push(v === 3 || v === 4 || v === 5 || v === 6 ? v : null);
  }
  return out;
}

// --- 내보내기 / 가져오기 ---
// 코스 설정과 라운드 기록을 통째로 담는다. 기기를 바꿔도 그대로 복원된다.

function exportAll() {
  return JSON.stringify(loadDB(), null, 2);
}

function importAll(json, mode) {
  const incoming = JSON.parse(json);
  if (!incoming || !Array.isArray(incoming.clubs) || !Array.isArray(incoming.rounds)) {
    throw new Error('형식이 올바르지 않습니다');
  }
  if (mode === 'replace') {
    saveDB({ version: 1, clubs: incoming.clubs, rounds: incoming.rounds });
    return { clubs: incoming.clubs.length, rounds: incoming.rounds.length };
  }
  // 합치기: id가 겹치지 않는 것만 추가
  const db = loadDB();
  const clubIds = new Set(db.clubs.map((c) => c.id));
  const roundIds = new Set(db.rounds.map((r) => r.id));
  let addedClubs = 0;
  let addedRounds = 0;
  incoming.clubs.forEach((c) => {
    if (!clubIds.has(c.id)) { db.clubs.push(c); addedClubs++; }
  });
  incoming.rounds.forEach((r) => {
    if (!roundIds.has(r.id)) { db.rounds.push(r); addedRounds++; }
  });
  saveDB(db);
  return { clubs: addedClubs, rounds: addedRounds };
}

// --- 라운드 ---
// 라운드를 만들 때 코스의 이름과 파 배치를 복사해서 넣는다(스냅샷).
// 나중에 코스 설정을 고쳐도 지난 라운드 기록은 그대로 남는다.

function makeHoles(pars) {
  return pars.map((par) => ({
    par: par,          // 3~6 또는 null(아직 모름)
    strokes: null,     // 타수
    putts: null,       // 퍼트 수
    tee: null,         // 'L' | 'F' | 'R' | null (선택 입력)
    penalty: null,     // 'ob' | 'hazard' | 'unplayable' | null (선택 입력)
  }));
}

function snapshotCourse(club, courseId) {
  const course = club.courses.find((c) => c.id === courseId);
  if (!course) return null;
  return { courseId: course.id, name: course.name, pars: course.pars.slice() };
}

function createRound({ clubId, frontCourseId, backCourseId, date }) {
  const db = loadDB();
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) return null;

  const front = snapshotCourse(club, frontCourseId);
  if (!front) return null;
  const back = backCourseId ? snapshotCourse(club, backCourseId) : null;

  const pars = front.pars.concat(back ? back.pars : []);
  const round = {
    id: newId(),
    createdAt: new Date().toISOString(),
    date: date || todayString(),
    clubId: club.id,
    clubName: club.name,
    front: front,
    back: back,
    holes: makeHoles(pars),
    currentHole: 0,
    finished: false,
  };
  db.rounds.push(round);
  saveDB(db);
  return round;
}

function todayString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 최근 날짜순
function getRounds() {
  return loadDB().rounds.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getRound(roundId) {
  return loadDB().rounds.find((r) => r.id === roundId) || null;
}

// 아직 끝내지 않은 라운드(이어하기용). 가장 최근 것 하나.
function getActiveRound() {
  return getRounds().find((r) => !r.finished) || null;
}

function saveRound(round) {
  const db = loadDB();
  const i = db.rounds.findIndex((r) => r.id === round.id);
  if (i === -1) return false;
  db.rounds[i] = round;
  return saveDB(db);
}

function updateHole(roundId, index, patch) {
  const round = getRound(roundId);
  if (!round || !round.holes[index]) return null;
  Object.assign(round.holes[index], patch);
  saveRound(round);
  return round;
}

function setCurrentHole(roundId, index) {
  const round = getRound(roundId);
  if (!round) return null;
  round.currentHole = Math.max(0, Math.min(index, round.holes.length - 1));
  saveRound(round);
  return round;
}

function finishRound(roundId) {
  const round = getRound(roundId);
  if (!round) return null;
  round.finished = true;
  saveRound(round);
  return round;
}

function reopenRound(roundId) {
  const round = getRound(roundId);
  if (!round) return null;
  round.finished = false;
  saveRound(round);
  return round;
}

function deleteRound(roundId) {
  const db = loadDB();
  db.rounds = db.rounds.filter((r) => r.id !== roundId);
  saveDB(db);
}

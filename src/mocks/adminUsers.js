const CITY_STATES = [
  ['São Paulo', 'SP'],
  ['Rio de Janeiro', 'RJ'],
  ['Belo Horizonte', 'MG'],
  ['Curitiba', 'PR'],
  ['Porto Alegre', 'RS'],
  ['Salvador', 'BA'],
  ['Recife', 'PE'],
  ['Fortaleza', 'CE'],
  ['Goiânia', 'GO'],
  ['Brasília', 'DF'],
  ['Campinas', 'SP'],
  ['Londrina', 'PR']
];

const FIRST_NAMES = [
  'Ana',
  'Lucas',
  'Marina',
  'João',
  'Beatriz',
  'Caio',
  'Sofia',
  'Pedro',
  'Isabela',
  'Rafael',
  'Helena',
  'Gustavo',
  'Larissa',
  'Thiago',
  'Nina',
  'Matheus'
];

const LAST_NAMES = ['Silva', 'Souza', 'Oliveira', 'Costa', 'Lima', 'Rocha', 'Mendes', 'Fernandes', 'Torres', 'Barbosa'];
const SONGS = ['Luzes da Cidade', 'Acústico no Escuro', 'Faixa Secreta', 'Noite Inteira', 'Horizonte Azul', 'Replay de Verão', 'Pista Aberta', 'Último Refrão'];
const GENDERS = ['Feminino', 'Masculino', 'Não informar'];

export const USER_GENDER_OPTIONS = [
  { value: 'all', label: 'Todos os sexos' },
  { value: 'Feminino', label: 'Feminino' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Não informar', label: 'Não informar' }
];

export const USER_AGE_RANGE_OPTIONS = [
  { value: 'all', label: 'Todas as idades' },
  { value: '12-18', label: '12 até 18 anos' }
];

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' }
];

export const DASHBOARD_REGION_OPTIONS = [
  { value: 'all', label: 'Todo o Brasil' },
  { value: 'sudeste', label: 'Sudeste' },
  { value: 'sul', label: 'Sul' },
  { value: 'nordeste', label: 'Nordeste' },
  { value: 'centro-oeste', label: 'Centro-Oeste' }
];

export const DASHBOARD_VOLUME_OPTIONS = [
  { value: 'all', label: 'Todo volume' },
  { value: 'high', label: 'Alto volume' },
  { value: 'medium', label: 'Volume médio' },
  { value: 'low', label: 'Baixo volume' }
];

export const DASHBOARD_TAB_OPTIONS = [
  { value: 'users', label: 'Superfãs' },
  { value: 'music', label: 'Top Músicas' },
  { value: 'cities', label: 'Top Cidades' }
];

export const DASHBOARD_USER_SORT_OPTIONS = [
  { value: 'plays', label: 'Mais reproduções' },
  { value: 'activity', label: 'Maior atividade' }
];

export const DASHBOARD_MUSIC_SORT_OPTIONS = [
  { value: 'plays', label: 'Mais reproduções' },
  { value: 'live', label: 'Ouvintes simultâneos agora' },
  { value: 'peak', label: 'Pico simultâneo' }
];

export const DASHBOARD_CITY_SORT_OPTIONS = [
  { value: 'plays', label: 'Mais reproduções' },
  { value: 'live', label: 'Ouvintes simultâneos agora' },
  { value: 'peak', label: 'Pico simultâneo' }
];

export const INITIAL_USERS_BATCH = 50;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatStreamDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
}

function getRegion(state) {
  if (['SP', 'RJ', 'MG'].includes(state)) return 'sudeste';
  if (['PR', 'RS'].includes(state)) return 'sul';
  if (['BA', 'PE', 'CE'].includes(state)) return 'nordeste';
  return 'centro-oeste';
}

function makeUser(index) {
  const [city, state] = CITY_STATES[index % CITY_STATES.length];
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[index % LAST_NAMES.length];
  const secondLastName = LAST_NAMES[(index + 3) % LAST_NAMES.length];
  const fullName = `${firstName} ${lastName} ${secondLastName}`;
  const age = 13 + (index % 19);
  const gender = GENDERS[index % GENDERS.length];
  const playsCount = 120 + index * 17;
  const activityCount = 40 + index * 9;
  const isOnline = index % 5 === 0 || index % 11 === 0;
  const isActive = index % 4 !== 0;
  const isInteracting = index % 3 === 0;
  const openChats = index % 7 === 0 ? 2 : index % 5 === 0 ? 1 : 0;
  const sessionMinutes = 12 + (index % 14) * 4;
  const lastStreamDate = new Date(Date.now() - (index + 2) * 1000 * 60 * 37);
  const lastSong = SONGS[index % SONGS.length];

  return {
    id: `user-${index + 1}`,
    name: fullName,
    fullName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@fanverse.app`,
    role: index < 3 ? 'ADMIN' : 'USER',
    city,
    state,
    cityState: `${city}-${state}`,
    region: getRegion(state),
    age,
    gender,
    isMinor: age <= 18,
    isOnline,
    isActive,
    isInteracting,
    openChats,
    sessionMinutes,
    playsCount,
    activityCount,
    avatarInitials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
    lastStream: {
      at: lastStreamDate.toISOString(),
      displayDate: formatStreamDate(lastStreamDate),
      song: lastSong
    },
    acceptedTermsAt: new Date(Date.now() - (index + 9) * 1000 * 60 * 60 * 14).toISOString(),
    registeredData: {
      cidadeEstado: `${city}-${state}`,
      idade: age,
      sexo: gender,
      telefone: `(11) 9${pad((index % 90) + 10)}${pad((index % 80) + 10)}-${pad((index % 70) + 10)}${pad((index % 60) + 10)}`
    },
    streams: Array.from({ length: 4 }).map((_, streamIndex) => {
      const playedAt = new Date(Date.now() - (index * 4 + streamIndex + 1) * 1000 * 60 * 58);
      return {
        id: `stream-${index + 1}-${streamIndex + 1}`,
        song: SONGS[(index + streamIndex) % SONGS.length],
        playedAt: playedAt.toISOString(),
        displayDate: `${formatStreamDate(playedAt)} ${pad(playedAt.getHours())}:${pad(playedAt.getMinutes())}`
      };
    })
  };
}

export const mockUsers = Array.from({ length: 140 }, (_, index) => makeUser(index));

export const mockDashboardMusic = [
  { id: 'song-1', title: 'Luzes da Cidade', plays: 18420, simultaneousNow: 442, peakSimultaneous: 690, topCityState: 'São Paulo-SP', isOnline: true, isNew: true, region: 'sudeste' },
  { id: 'song-2', title: 'Acústico no Escuro', plays: 16310, simultaneousNow: 380, peakSimultaneous: 612, topCityState: 'Curitiba-PR', isOnline: true, isNew: true, region: 'sul' },
  { id: 'song-3', title: 'Faixa Secreta', plays: 14990, simultaneousNow: 310, peakSimultaneous: 540, topCityState: 'Belo Horizonte-MG', isOnline: true, isNew: true, region: 'sudeste' },
  { id: 'song-4', title: 'Noite Inteira', plays: 13840, simultaneousNow: 250, peakSimultaneous: 481, topCityState: 'Recife-PE', isOnline: false, isNew: false, region: 'nordeste' },
  { id: 'song-5', title: 'Horizonte Azul', plays: 12230, simultaneousNow: 210, peakSimultaneous: 402, topCityState: 'Rio de Janeiro-RJ', isOnline: false, isNew: false, region: 'sudeste' },
  { id: 'song-6', title: 'Replay de Verão', plays: 11780, simultaneousNow: 196, peakSimultaneous: 365, topCityState: 'Salvador-BA', isOnline: false, isNew: false, region: 'nordeste' }
];

export const mockDashboardCities = [
  { id: 'city-1', cityState: 'São Paulo-SP', plays: 32100, simultaneousNow: 690, peakSimultaneous: 920, region: 'sudeste' },
  { id: 'city-2', cityState: 'Rio de Janeiro-RJ', plays: 27640, simultaneousNow: 590, peakSimultaneous: 812, region: 'sudeste' },
  { id: 'city-3', cityState: 'Curitiba-PR', plays: 21980, simultaneousNow: 430, peakSimultaneous: 648, region: 'sul' },
  { id: 'city-4', cityState: 'Belo Horizonte-MG', plays: 20320, simultaneousNow: 402, peakSimultaneous: 610, region: 'sudeste' },
  { id: 'city-5', cityState: 'Recife-PE', plays: 18450, simultaneousNow: 365, peakSimultaneous: 520, region: 'nordeste' },
  { id: 'city-6', cityState: 'Goiânia-GO', plays: 16920, simultaneousNow: 322, peakSimultaneous: 470, region: 'centro-oeste' }
];

export function calculateUsersKpis(users) {
  const total = users.length;
  const active = users.filter((user) => user.isActive).length;
  const minors = users.filter((user) => user.isMinor).length;
  const averagePlays = total > 0 ? Math.round(users.reduce((sum, user) => sum + user.playsCount, 0) / total) : 0;

  return {
    total,
    active,
    activePercentage: total > 0 ? Math.round((active / total) * 100) : 0,
    minors,
    minorsPercentage: total > 0 ? Math.round((minors / total) * 100) : 0,
    averagePlays
  };
}

export function calculateDashboardKpis(users) {
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const onlineUsers = users.filter((user) => user.isOnline).length;
  const interactingUsers = users.filter((user) => user.isInteracting).length;
  const avgSessionMinutes = totalUsers > 0 ? Math.round(users.reduce((sum, user) => sum + user.sessionMinutes, 0) / totalUsers) : 0;
  const openChatSessions = users.reduce((sum, user) => sum + user.openChats, 0);

  return {
    totalUsers,
    activeUsers,
    onlineUsers,
    interactingUsers,
    avgSessionMinutes,
    openChatSessions
  };
}

export function queryUsers({ users, name = '', cityState = '', ageRange = 'all', gender = 'all', lastStreamDate = '', lastStreamSong = '' }) {
  const nameTerm = name.trim().toLowerCase();
  const cityTerm = cityState.trim().toLowerCase();
  const songTerm = lastStreamSong.trim().toLowerCase();
  const dateTerm = lastStreamDate.trim();

  return users
    .filter((user) => {
      if (nameTerm && !`${user.name} ${user.email}`.toLowerCase().includes(nameTerm)) return false;
      if (cityTerm && !user.cityState.toLowerCase().includes(cityTerm)) return false;
      if (ageRange === '12-18' && !(user.age >= 12 && user.age <= 18)) return false;
      if (gender !== 'all' && user.gender !== gender) return false;
      if (dateTerm && user.lastStream.displayDate !== dateTerm) return false;
      if (songTerm && !user.lastStream.song.toLowerCase().includes(songTerm)) return false;
      return true;
    })
    .sort((a, b) => {
      const onlineDiff = Number(b.isOnline) - Number(a.isOnline);
      if (onlineDiff !== 0) return onlineDiff;

      const activityDiff = b.activityCount - a.activityCount;
      if (activityDiff !== 0) return activityDiff;

      return b.playsCount - a.playsCount;
    });
}

export async function fetchUsersMock({ users = mockUsers, shouldFail = false }) {
  await new Promise((resolve) => setTimeout(resolve, 280));
  if (shouldFail) {
    throw new Error('Não foi possível carregar a base de usuários.');
  }

  return {
    users,
    userKpis: calculateUsersKpis(users),
    dashboardKpis: calculateDashboardKpis(users)
  };
}

export async function fetchUsersFromApi({ apiFetch }) {
  const payload = await apiFetch('/admin/users?page=1&limit=500');
  const users = Array.isArray(payload?.users) ? payload.users : [];
  return {
    users,
    userKpis: calculateUsersKpis(users),
    dashboardKpis: calculateDashboardKpis(users)
  };
}

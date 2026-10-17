// Brief F-006 (BR-31): a new password must not be easy to guess. This list is hand-picked, not a breach corpus:
// the most common passwords worldwide and in Vietnam, in lower case, 8 characters or more (shorter ones fail the length rule).
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  // Digits and keyboard runs
  '12345678', '123456789', '1234567890', '0123456789', '987654321', '9876543210', '87654321', '11223344', '12341234',
  '12121212', '123123123', '1234512345', '123654789', '147258369', '159753456', '123456123', '1122334455', '1qaz2wsx',
  '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'q1w2e3r4t5', 'qwertyui', 'qwertyuiop', 'qwerty123', 'qwerty12', 'asdfghjk',
  'asdfghjkl', 'zxcvbnm1', 'zxcvbnm123', 'qazwsxedc', '1qazxsw2', 'zaq12wsx', 'abcd1234', 'abc12345', 'abc123456',
  'abcdefgh', 'abcdef123', 'a1b2c3d4', 'aa123456', 'a12345678', '12345678a', '123456789a', '12345qwert', 'asdf1234',
  'qwer1234', '1234qwer', 'qweasdzxc', '66668888', '88888888', '68686868', '86868686', '99999999', '00000000',
  // The repeated-character rule blocks these too. They stay, so the list reads complete on its own.
  '11111111', '22222222', '55555555', '77777777', '12344321', '20202020', '19001900',
  // English words
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'pass1234', 'iloveyou',
  'iloveyou1', 'iloveyou2', 'princess', 'sunshine', 'football', 'football1', 'baseball', 'superman', 'batman123',
  'starwars', 'trustno1', 'welcome1', 'welcome123', 'whatever', 'computer', 'internet', 'letmein1', 'master123',
  'michael1', 'jennifer', 'charlie1', 'basketball', 'liverpool', 'chelsea1', 'arsenal1', 'manchester', 'manutd123',
  'barcelona', 'realmadrid', 'cristiano', 'ronaldo7', 'messi123', 'pokemon1', 'naruto123', 'dragon123', 'monkey123',
  'shadow123', 'freedom1', 'loveyou1', 'lovely123', 'secret123', 'changeme', 'default1', 'admin123', 'admin1234',
  'administrator', 'root1234', 'login123', 'test1234', 'testtest', 'guest123', 'google123', 'facebook', 'facebook1',
  'zalo1234', 'badminton', 'badminton1', 'yonex123', 'tennis123', 'pickleball', 'soccer123', 'sport123', 'sports123',
  // Vietnamese words, written without tone marks
  'matkhau1', 'matkhau12', 'matkhau123', 'matkhau1234', 'matkhaumoi', 'matkhau@123', 'anhyeuem',
  'anhyeuem1', 'anhyeuem123', 'emyeuanh', 'emyeuanh1', 'emyeuanh123', 'yeuemnhieu', 'yeuanhnhieu', 'toiyeuban',
  'iloveyou123', 'saigon123', 'hanoi123', 'hanoi1234', 'hochiminh', 'vietnam1', 'vietnam123', 'vietnam1234',
  'vietnam2026', 'nguyen123', 'nguyenvan', 'tranvan123', 'levan123', 'phamvan123', 'hoangvan123', 'conyeu123',
  'meyeucon', 'boyeucon', 'giadinh123', 'hanhphuc', 'hanhphuc123', 'thanhcong', 'baoanh123', 'minhanh123',
  'ngocanh123', 'thanhhuyen', 'trungkien', 'hoanganh123', 'xinchao123', 'xinchao1', 'khongbiet', 'khongcomatkhau',
  'quenmatkhau', 'caulong123', 'bongda123', 'bongda1234', 'sanbong123', 'datsan123', 'thethao123',
  // This service
  'monsport', 'monsport1', 'monsport123', 'monsport2026', 'mon-sport', 'mon sport',
]);

/**
 * True when a new password is easy to guess (brief F-006, BR-31): it is on the list (any case),
 * it contains the phone number of the account (also without its leading 0), or it repeats one character.
 */
export function isWeakPassword(password: string, phone: string): boolean {
  const lower = password.toLowerCase();
  const hasPhone = phone.length > 1 && password.includes(phone.slice(1));
  return COMMON_PASSWORDS.has(lower) || hasPhone || /^(.)\1*$/su.test(password);
}

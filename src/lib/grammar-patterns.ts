/**
 * Regex tìm câu trong transcript có dùng cấu trúc của từng unit (khoá = id unit).
 * Chỉ là heuristic để gợi ý ví dụ thật: có thể bắt nhầm hoặc sót; unit khó nhận ra bằng regex thì bỏ qua.
 */

/** quá khứ phân từ: -ed + các động từ bất quy tắc hay gặp */
const PP =
  "(?:\\w+ed|been|done|gone|seen|made|taken|given|known|got|gotten|come|become|written|said|told|found|thought|brought|bought|left|lost|heard|met|kept|felt|had|put|run|won|begun|eaten|spoken|broken|chosen|forgotten|driven|flown|grown|shown|thrown|fallen|stolen|worn|read|built|sent|spent|caught|taught|fought|paid|sold|held|understood|forgiven|hidden|ridden|woken|cut|set|hit|shut|hurt|cost)"
/** -ing nhưng bỏ các danh từ tận cùng -ing hay gặp (something, morning…) */
const ING =
  '(?!(?:some|any|every|no)thing\\b|morning\\b|evening\\b|during\\b|bring\\b|king\\b|ring\\b|sing\\b|spring\\b|ceiling\\b|wedding\\b|building\\b|meeting\\b|thing\\b|nothing\\b|string\\b)\\w{2,}ing'
const ADV = "(?:\\w+ly\\s+|just\\s+|never\\s+|ever\\s+|already\\s+|always\\s+|still\\s+|not\\s+)?"
const BE_NOW_WORDS = "am|is|are|i'm|you're|we're|they're|he's|she's|it's|that's"
const BE_NOW = `(?:${BE_NOW_WORDS})`
const PHRASAL = (verbs: string, particles: string) =>
  new RegExp(
    `\\b(?:${verbs})\\w{0,3}\\s+(?:(?:it|them|him|her|me|us|this|that)\\s+|(?:the|a|an|my|your|his|her|our|their)\\s+\\w+\\s+)?(?:${particles})\\b`,
    'i',
  )

const re = (src: string) => new RegExp(src, 'i')

const presentContinuous = re(
  `\\b${BE_NOW}\\s+${ADV}(?!going to\\b)${ING}\\b|\\b(?:am|is|are|isn't|aren't)\\s+(?:i|you|he|she|it|we|they)\\s+${ING}\\b`,
)
const presentSimple = re("\\b(?:he|she|it)\\s+(?:\\w+ly\\s+)?(?!(?:is|was|has|does|'s)\\b)\\w+[^s\\W]s\\b|\\b(?:don't|doesn't)\\s+\\w+")
const presentPerfect = re(
  `\\b(?:have|has|haven't|hasn't|i've|you've|we've|they've)\\s+(?:(?:i|you|he|she|it|we|they)\\s+)?${ADV}${PP}\\b`,
)
const presentPerfectContinuous = re(`\\b(?:have|has|i've|you've|we've|they've|he's|she's|it's)\\s+${ADV}been\\s+${ING}\\b`)
const will = re("\\b(?:will|won't|shall|i'll|you'll|we'll|they'll|he'll|she'll|it'll)\\s+(?:not\\s+)?\\w+")
const may = re('\\b(?:may|might)\\s+(?:not\\s+)?\\w+')
const should = re("\\bshould(?:n't)?\\s+\\w+")
const reported = re('\\b(?:said|told\\s+\\w+|asked\\s+\\w+|explained|mentioned)\\s+(?:that|to|if|whether)\\b')
const phrasalUpDown = PHRASAL(
  'get|give|gave|set|pick|make|made|look|turn|bring|brought|grow|end|break|broke|shut|calm|slow|sit|sat|stand|stood|write|wrote|cut|let|put|show|wake|woke|clean|use|take|took|come|came|fill|hang|hung|pull|run|ran|blow|blew|tear|tore|back|keep|kept',
  'up|down',
)

export const GRAMMAR_PATTERNS: Partial<Record<string, RegExp>> = {
  '1': presentContinuous,
  '2': presentSimple,
  '3': presentContinuous,
  '4': presentContinuous,
  '5': re(`\\b(?:did|didn't)\\s+\\w+|\\b\\w+ed\\b[^.?!]*\\b(?:yesterday|ago|last (?:week|month|year|night|time))\\b`),
  '6': re(`\\b(?:was|were|wasn't|weren't)\\s+${ADV}${ING}\\b`),
  '7': presentPerfect,
  '8': presentPerfect,
  '9': presentPerfectContinuous,
  '10': presentPerfectContinuous,
  '11': re('\\bhow long\\s+(?:have|has)\\b'),
  '12': re("\\b(?:have|has|'ve)\\b[^.?!]*\\b(?:since|for (?:\\d+|a|an|two|three|several|many|ages|years|months|weeks|days|hours))\\b"),
  '13': presentPerfect,
  '14': presentPerfect,
  '15': re(`\\b(?:had|hadn't|i'd|he'd|she'd|we'd|they'd|you'd)\\s+${ADV}(?!better\\b)${PP}\\b`),
  '16': re(`\\bhad\\s+${ADV}been\\s+${ING}\\b`),
  '17': re("\\b(?:have|has|haven't|hasn't|i've|you've|we've|they've|he's|she's|it's)\\s+got\\b"),
  '18': re("(?<!(?:\\b(?:be|is|am|are|was|were|get|got|getting|been|being)|'m|'re|'s)\\s)\\bused to\\s+(?!(?:it|this|that|them|him|her)\\b|\\w+ing\\b)\\w+|\\buse to\\s+\\w+"),
  '20': re(`\\b(?:${BE_NOW_WORDS}|was|were)\\s+(?:not\\s+)?going to\\s+\\w+|\\bgonna\\b`),
  '21': will,
  '22': will,
  '23': will,
  '24': re(`\\bwill\\s+(?:be\\s+${ING}|have\\s+${PP})\\b`),
  '26': re("\\b(?:can|could|can't|couldn't|cannot|able to)\\s+\\w+"),
  '27': re(`\\bcould(?:n't)?\\s+have\\s+${PP}\\b`),
  '28': re("\\b(?:must|can't)\\s+(?:be|have)\\b"),
  '29': may,
  '30': may,
  '31': re('\\b(?:have to|has to|had to|must)\\s+\\w+'),
  '32': re("\\b(?:mustn't|needn't|don't need to|doesn't need to|didn't need to)\\b"),
  '33': should,
  '34': should,
  '35': re("\\b(?:had better|'d better|it's time|it is time)\\b"),
  '36': re("\\bwould(?:n't)?\\s+\\w+"),
  '37': re('(?:^|[.?!]\\s+)(?:can|could|would|will)\\s+you\\b'),
  '38': re("\\bif\\b[^.?!]*\\b(?:will|'ll|won't)\\b"),
  '39': re("\\bif\\s+\\w+\\s+(?:were|was|had|knew|did|could|\\w+ed)\\b[^.?!]*\\b(?:would|'d|could|might)\\b"),
  '40': re(`\\bif\\b[^.?!]*\\bhad\\s+${PP}\\b|\\b(?:would|could|might)(?:n't)?\\s+have\\s+${PP}\\b`),
  '41': re('\\b(?:wish|wished|if only)\\b'),
  '42': re(`\\b(?:is|are|was|were|isn't|aren't|wasn't|weren't)\\s+${ADV}${PP}\\b`),
  '43': re(`\\b(?:be|been|being)\\s+${ADV}${PP}\\b`),
  '44': re(`\\b(?:is|are|was|were)\\s+(?:given|told|asked|offered|shown|sent|paid)\\b`),
  '45': re('\\b(?:is|are|was|were)\\s+(?:said|supposed|believed|thought|reported|expected|known|alleged)\\s+to\\b|\\bit is (?:said|believed|thought|reported)\\b'),
  '46': re(`\\b(?:have|has|had|get|got|getting|having)\\s+(?:my|your|his|her|our|their|the|it|a)\\s+\\w+\\s+${PP}\\b`),
  '47': reported,
  '48': reported,
  '49': re('(?:^|[.!]\\s+)(?:what|where|when|why|who|how|do|does|did|is|are|have|has)\\b[^.?!]*\\?'),
  '50': re("\\b(?:do you know|can you tell me|i wonder|i don't know|asked (?:me|him|her|them|us))\\s+(?:where|what|when|why|how|if|whether|who)\\b"),
  '51': re("\\bi (?:think|hope|guess|suppose|expect) so\\b|\\bso (?:do|am|have|can|did|was) i\\b|\\bneither (?:do|am|have|can|did) i\\b"),
  '52': re("\\b(?:isn't|aren't|don't|doesn't|didn't|wasn't|weren't|won't|can't|haven't|hasn't|is|are|do|does|did|was|will|can|have|has)\\s+(?:it|he|she|you|they|we|i|there)\\s*\\?"),
  '53': re(`\\b(?:enjoy|stop|finish|mind|avoid|keep|kept|consider|suggest|imagine|miss|practi[cs]e|give up|gave up|carry on|carried on|put off|deny|risk)\\w{0,3}\\s+${ING}\\b`),
  '54': re('\\b(?:decide|want|hope|plan|agree|promise|refuse|manage|offer|learn|tr[yi]|need|forget|forgot|afford|threaten|seem|pretend|arrange|fail)\\w{0,3}\\s+to\\s+\\w+'),
  '55': re('\\b(?:want|ask|tell|told|expect|allow|help|encourage|persuade|teach|taught|remind|warn|invite|force|would like)\\w{0,3}\\s+(?:me|you|him|her|us|them)\\s+to\\s+\\w+'),
  '56': re(`\\b(?:remember|regret|forget|forgot|go on|went on)\\w{0,3}\\s+(?:to\\s+\\w+|${ING}\\b)`),
  '57': re(`\\b(?:try|tried|need|needs|needed|help|helped|can't help)\\s+${ING}\\b`),
  '58': re(`\\b(?:would like|'d like|would love|'d love|would hate|'d hate|would prefer|'d prefer)\\s+to\\b|\\b(?:like|love|hate|prefer)s?\\s+${ING}\\b`),
  '59': re("\\b(?:prefer|would rather|'d rather)\\b"),
  '60': re(`\\b(?:of|in|at|for|about|without|before|after|by|instead of)\\s+${ING}\\b`),
  '61': re('\\b(?:be|am|is|are|was|were|been|get|got|getting|i\'m|you\'re|we\'re|they\'re)\\s+used to\\b'),
  '62': re(`\\b(?:succeed|insist|think|dream|approve|accuse|suspect|congratulate|prevent|stop|thank|apologi[sz]e|forgive|keep|look forward to)\\w{0,3}\\s+(?:\\w+\\s+)?(?:in|on|of|about|from|for|to)\\s+${ING}\\b`),
  '63': re(`\\b(?:it's no use|it's not worth|there's no point in|it's worth|have (?:a hard time|trouble|difficulty)|spend\\s+\\w+\\s+\\w+|waste\\s+\\w+\\s+\\w+)\\s+${ING}\\b|\\bgo (?:shopping|swimming|fishing|skiing|running|sailing|camping)\\b`),
  '64': re('\\bso that\\b|\\bin order (?:to|that)\\b'),
  '65': re("\\b(?:it's|it is|it was|it'll be)\\s+(?:\\w+\\s+)?\\w+\\s+to\\s+\\w+|\\b(?:is|was|are)\\s+(?:likely|certain|sure|the first|the last)\\s+to\\b"),
  '66': re(`\\b(?:afraid|scared|sorry|interested)\\s+(?:to\\s+\\w+|of\\s+${ING}|in\\s+${ING})\\b`),
  '67': re(`\\b(?:saw|see|seen|watched|watch|heard|hear|noticed|notice|felt|feel|smell|smelled)\\s+(?:him|her|them|me|us|you|it|someone|somebody)\\s+(?:${ING}|\\w+)\\b`),
  '68': re(`(?:^|[.!?]\\s+)(?:${ING}|having\\s+${PP})\\b[^,.?!]*,`),
  '82': re('\\b(?:myself|yourself|himself|herself|itself|ourselves|yourselves|themselves)\\b'),
  '83': re('\\b(?:of (?:mine|yours|his|hers|ours|theirs)|my own|your own|his own|her own|our own|their own|on (?:my|your|his|her|our|their) own)\\b'),
  '84': re("\\bthere\\s+(?:is|are|was|were|'s|will be|has been|have been|must be|might be)\\b"),
  '85': re('\\b(?:some|any)(?:one|body|thing|where)?\\b'),
  '86': re('\\b(?:none|nothing|nobody|no one|nowhere)\\b'),
  '87': re('\\b(?:much|many|a little|a few|few|little|a lot of|lots of|plenty of)\\b'),
  '88': re('\\b(?:all|most|some|none|any|half|each)\\s+of\\b'),
  '89': re('\\b(?:both|either|neither)\\b'),
  '90': re('\\b(?:every|whole|everyone|everything|everybody)\\b'),
  '91': re('\\b(?:each|every)\\b'),
  '92': re("\\b(?!(?:know|knows|knew|said|say|think|thought|asked|wonder|tell|told|see|saw|sure|is|was|that|and|but|or)\\b)\\w+\\s+(?:who|which|that)\\s+(?:is|are|was|were|has|have|had|can|could|will|would|\\w+s|\\w+ed)\\b"),
  '93': re("\\b(?:the|a|an)\\s+\\w+\\s+(?:i|you|we|they|he|she)\\s+(?:\\w+ed|saw|met|bought|made|took|got|had|want|need|like|love)\\b"),
  '94': re('\\b(?:whose|whom)\\b|\\b(?:place|city|town|house|room|country|restaurant|hotel|street)\\s+where\\b'),
  '95': re('\\w,\\s+(?:who|which|whose|where)\\b'),
  '96': re('\\w,\\s+(?:most of|all of|some of|many of|none of|both of)\\s+(?:whom|which)\\b|,\\s+which\\b'),
  '98': re('\\b(?:bor|interest|excit|tir|surpris|amaz|confus|disappoint|embarrass|annoy|frighten|worr|shock|satisf|exhaust|depress)(?:ed|ing|ied|ying)\\b'),
  '100': re('\\b(?:quickly|slowly|carefully|easily|badly|happily|seriously|quietly|loudly|suddenly|completely|perfectly|clearly|properly|nicely)\\b'),
  '102': re('\\bsuch\\s+(?:a|an)?\\s*\\w+|\\bso\\s+\\w+\\s+that\\b'),
  '103': re('\\benough\\b|\\btoo\\s+\\w+\\s+(?:to|for)\\b'),
  '104': re('\\b(?:quite|rather|fairly)\\s+\\w+|\\bpretty\\s+(?:good|bad|well|much|sure|easy|hard|big|small|cool|nice|quick|fast|slow|amazing)\\b'),
  '105': re('\\b(?:\\w+er|more\\s+\\w+|less\\s+\\w+|better|worse)\\s+than\\b'),
  '106': re('\\b(?:much|far|a bit|a little|even|any|no)\\s+(?:\\w{3,}er|more|better|worse|less)\\b|\\bthe\\s+\\w+er\\b[^.?!]*,\\s*the\\s+\\w+er\\b|\\b(\\w+er) and \\1\\b'),
  '107': re('\\bas\\s+(?:\\w+\\s+)?\\w+\\s+as\\b'),
  '108': re('\\bthe\\s+(?:(?!rest|west|test|guest|interest|chest|nest|request|forest|contest|protest)\\w{2,}est|most\\s+\\w+|best|worst|least\\s+\\w+)\\b'),
  '111': re('\\b(?:still|yet|already|any ?more|any longer|no longer)\\b'),
  '112': re('\\beven\\b(?!\\s+(?:though|if)\\b)'),
  '113': re('\\b(?:although|though|even though|in spite of|despite)\\b'),
  '114': re('\\bin case\\b'),
  '115': re('\\b(?:unless|as long as|provided|providing)\\b'),
  '116': re('(?:^|[.,]\\s*)as\\s+(?:i|you|he|she|we|they|it)\\s+\\w+'),
  '118': re('\\b(?:as if|as though)\\b|\\b(?:look|looks|looked|sound|sounds|sounded|feel|feels|felt) like\\b'),
  '119': re('\\b(?:during|while)\\b'),
  '120': re('\\b(?:until|till|by the time)\\b'),
  '121': re('\\b(?:at\\s+(?:\\d|night|midnight|noon|the weekend|christmas)|on\\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?|in\\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|the morning|the afternoon|the evening|\\d{4}|summer|winter|spring|autumn))\\b'),
  '122': re('\\b(?:on time|in time|at the end|in the end)\\b'),
  '137': PHRASAL('get|go|come|look|turn|take|put|give|break|run|set|bring|make|sit|stand|fall|hold|pick', 'up|down|out|off|on|away|back|in|over|around'),
  '138': PHRASAL('get|come|go|break|move|fill|check|drop|hand|join|look|pop|let|lock|leave|walk|run|plug|cut|log|sign|give', 'in|out'),
  '139': PHRASAL('find|work|figure|run|carry|point|sort|turn|come|go|pass|stand|try|leave|cross|watch|look|hand|give|put|sell|wear|stretch|break|eat|hang|chill|freak|check', 'out'),
  '140': PHRASAL('turn|switch|put|take|go|carry|keep|get|log|set|call|show|try|hold|drop|pay|kick|break|walk|cut|move|come|be', 'on|off'),
  '141': PHRASAL('turn|switch|put|take|go|carry|keep|get|log|set|call|show|try|hold|drop|pay|kick|break|walk|cut|move|come|be', 'on|off'),
  '142': phrasalUpDown,
  '143': phrasalUpDown,
  '144': phrasalUpDown,
  '145': PHRASAL('go|went|come|came|get|got|give|gave|put|take|took|throw|threw|run|ran|look|call|pay|paid|bring|brought|turn|walk|move|send|sent|fight|hit|blow', 'away|back'),
}

/** vị trí khớp đầu tiên [start, end) để tô sáng, null nếu câu không dùng cấu trúc */
export function matchGrammar(unitId: string, text: string): [number, number] | null {
  const m = GRAMMAR_PATTERNS[unitId]?.exec(text)
  if (!m) return null
  // bỏ phần mở đầu chỉ để neo (dấu câu, khoảng trắng)
  const lead = /^[\s.,!?]*/.exec(m[0])![0].length
  return [m.index + lead, m.index + m[0].length]
}

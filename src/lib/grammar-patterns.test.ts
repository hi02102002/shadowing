import { describe, expect, it } from 'vitest'

import { GRAMMAR_PATTERNS, matchGrammar } from './grammar-patterns.ts'

/** mỗi unit có regex phải bắt được ít nhất câu mẫu này */
const SAMPLES: Record<string, string> = {
  '1': "Please be quiet, I'm trying to work.",
  '2': 'She works in a bank.',
  '3': "Look, it's snowing.",
  '4': 'What are you thinking about?',
  '5': 'We visited them two years ago.',
  '6': 'I was walking home when it started to rain.',
  '7': "I've lost my keys.",
  '8': 'Have you ever eaten caviar?',
  '9': "It's been raining all day.",
  '10': 'She has been working here for years.',
  '11': 'How long have you known her?',
  '12': "I've lived here since 2010.",
  '13': 'He has gone to Spain.',
  '14': 'Have you seen Tom this morning?',
  '15': 'When I arrived, the film had started.',
  '16': 'He had been waiting for an hour.',
  '17': "She's got two brothers.",
  '18': 'I used to play tennis a lot.',
  '20': "I'm going to buy a new car.",
  '21': "I'll call you later.",
  '22': 'Will you help me?',
  '23': "I think it'll rain.",
  '24': 'This time tomorrow I will be lying on the beach.',
  '26': 'Can you swim?',
  '27': 'You could have told me.',
  '28': 'You must be tired.',
  '29': 'It might rain later.',
  '30': 'We may not go.',
  '31': 'I have to get up early.',
  '32': "You needn't worry.",
  '33': 'You should see a doctor.',
  '34': "You shouldn't eat so much.",
  '35': "You'd better hurry.",
  '36': 'I would love to come.',
  '37': 'Could you open the window?',
  '38': "If you hurry, you'll catch the bus.",
  '39': "If I knew her number, I'd call her.",
  '40': 'If I had known, I would have told you.',
  '41': 'I wish I had more time.',
  '42': 'The house was built in 1990.',
  '43': 'It should be done by now.',
  '44': 'I was given a present.',
  '45': 'He is said to be very rich.',
  '46': 'I had my hair cut yesterday.',
  '47': 'She said that she was tired.',
  '48': 'He told me that he was busy.',
  '49': 'Where do you live?',
  '50': 'Do you know where she lives?',
  '51': 'I think so.',
  '52': "It's a nice day, isn't it?",
  '53': 'I enjoy dancing.',
  '54': 'We decided to leave.',
  '55': 'I want you to stay.',
  '56': 'I remember locking the door.',
  '57': 'Try turning it off and on again.',
  '58': "I'd like to go home.",
  '59': "I'd rather stay at home.",
  '60': 'Thanks for helping me.',
  '61': "I'm used to working late.",
  '62': 'She insisted on paying.',
  '63': "It's no use worrying about it.",
  '64': 'Speak slowly so that everyone understands.',
  '65': "It's easy to make mistakes.",
  '66': "I'm afraid of falling.",
  '67': 'I saw him crossing the road.',
  '68': 'Feeling tired, I went to bed.',
  '82': 'I cut myself.',
  '83': "She's a friend of mine.",
  '84': 'There is a problem.',
  '85': 'Do you have any money?',
  '86': 'Nobody came.',
  '87': 'I have a few friends.',
  '88': 'Most of the people left.',
  '89': 'Both of them are right.',
  '90': 'I spent the whole day there.',
  '91': 'Each student has a book.',
  '92': 'The man who lives next door is a doctor.',
  '93': 'The book I bought was great.',
  '94': 'This is the house where I was born.',
  '95': 'My brother, who lives in London, is a teacher.',
  '96': 'She has two sons, both of whom are doctors.',
  '98': 'The film was boring.',
  '100': 'He drives carefully.',
  '102': 'It was such a nice day.',
  '103': "It's too cold to swim.",
  '104': "It's quite good.",
  '105': 'She is taller than me.',
  '106': "It's much better now.",
  '107': "I'm as tall as you.",
  '108': "It's the biggest city in the country.",
  '111': "I've already eaten.",
  '112': 'Even my mother likes it.',
  '113': 'Although it rained, we went out.',
  '114': 'Take an umbrella in case it rains.',
  '115': "Unless you hurry, you'll be late.",
  '116': 'As I was hungry, I ate something.',
  '118': 'You look as if you need a rest.',
  '119': 'I fell asleep during the film.',
  '120': 'Wait until I come back.',
  '121': "I'll see you on Monday.",
  '122': 'We arrived just in time.',
  '137': 'Please sit down.',
  '138': 'Come in and fill out this form.',
  '139': 'I need to find out the truth.',
  '140': 'Turn the light off.',
  '141': 'Carry on working.',
  '142': 'Please calm down.',
  '143': 'I gave up smoking.',
  '144': 'Pick it up.',
  '145': 'Give it back.',
}

describe('GRAMMAR_PATTERNS', () => {
  it('mỗi pattern có câu mẫu và bắt được câu đó', () => {
    for (const id of Object.keys(GRAMMAR_PATTERNS)) {
      const sample = SAMPLES[id]
      expect(sample, `unit ${id} thiếu câu mẫu`).toBeDefined()
      expect(matchGrammar(id, sample), `unit ${id}: "${sample}"`).not.toBeNull()
    }
  })

  it('không bắt danh từ tận cùng -ing hay so sánh nhất giả', () => {
    expect(matchGrammar('1', 'It is something new.')).toBeNull()
    expect(matchGrammar('108', 'Take the rest of the day off.')).toBeNull()
    expect(matchGrammar('18', "I'm used to it.")).toBeNull()
  })

  it('trả về vị trí khớp để tô sáng', () => {
    const text = 'Well, I used to play tennis.'
    const [s, e] = matchGrammar('18', text)!
    expect(text.slice(s, e)).toBe('used to play')
  })
})

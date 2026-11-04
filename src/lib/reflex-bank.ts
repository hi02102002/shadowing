/** Bộ câu luyện phản xạ soạn sẵn: mỗi dạng bài × mỗi cấp độ 10 câu, kèm câu mẫu */
import type { ReflexLevel, ReflexMode, ReflexPrompt } from './reflex.ts'

/** [câu tiếng Việt, câu tiếng Anh mẫu] */
type Pair = readonly [string, string]
/** [mẫu câu có ___, từ cần ghép, câu hoàn chỉnh] */
type Drill = readonly [string, string, string]

const TRANSLATE: Record<ReflexLevel, Pair[]> = {
  A1: [
    ['Tôi đói rồi.', "I'm hungry."],
    ['Bạn tên là gì?', "What's your name?"],
    ['Hôm nay trời nóng.', "It's hot today."],
    ['Tôi thích cà phê.', 'I like coffee.'],
    ['Nhà vệ sinh ở đâu?', 'Where is the bathroom?'],
    ['Tôi không hiểu.', "I don't understand."],
    ['Mẹ tôi là giáo viên.', 'My mother is a teacher.'],
    ['Bây giờ là mấy giờ?', 'What time is it?'],
    ['Tôi sống ở Hà Nội.', 'I live in Hanoi.'],
    ['Cái này bao nhiêu tiền?', 'How much is this?'],
  ],
  A2: [
    ['Hôm qua tôi đi làm muộn.', 'I was late for work yesterday.'],
    ['Bạn có thể nói chậm hơn không?', 'Could you speak more slowly?'],
    [
      'Cuối tuần này tôi sẽ về quê.',
      "I'm going back to my hometown this weekend.",
    ],
    [
      'Tôi đã học tiếng Anh được hai năm.',
      "I've been learning English for two years.",
    ],
    ['Em gái tôi cao hơn tôi.', 'My younger sister is taller than me.'],
    ['Tôi thường đi làm bằng xe máy.', 'I usually go to work by motorbike.'],
    ['Bạn đã bao giờ đến Đà Nẵng chưa?', 'Have you ever been to Da Nang?'],
    [
      'Tôi muốn đặt một bàn cho hai người.',
      "I'd like to book a table for two.",
    ],
    ['Đừng quên mang ô nhé.', "Don't forget to bring an umbrella."],
    [
      'Tôi bận quá nên chưa ăn trưa.',
      "I've been so busy that I haven't had lunch yet.",
    ],
  ],
  B1: [
    [
      'Nếu ngày mai trời mưa, chúng ta sẽ ở nhà.',
      "If it rains tomorrow, we'll stay at home.",
    ],
    ['Tôi ước gì mình có nhiều thời gian hơn.', 'I wish I had more time.'],
    [
      'Cuộc họp đã bị hoãn đến thứ Sáu.',
      'The meeting has been postponed until Friday.',
    ],
    [
      'Bạn có phiền nếu tôi mở cửa sổ không?',
      'Do you mind if I open the window?',
    ],
    [
      'Tôi đang tìm một công việc liên quan đến marketing.',
      "I'm looking for a job related to marketing.",
    ],
    [
      'Anh ấy bảo tôi rằng anh ấy sẽ đến muộn.',
      'He told me that he would be late.',
    ],
    [
      'Lẽ ra tôi nên nghe lời khuyên của bạn.',
      'I should have listened to your advice.',
    ],
    [
      'Càng luyện tập nhiều, bạn càng nói trôi chảy.',
      'The more you practise, the more fluently you speak.',
    ],
    ['Tôi không quen dậy sớm.', "I'm not used to getting up early."],
    [
      'Chiếc điện thoại tôi mua tuần trước đã bị hỏng.',
      'The phone I bought last week has already broken.',
    ],
  ],
  B2: [
    [
      'Giá như tôi biết sớm hơn, tôi đã có thể giúp bạn.',
      'If I had known earlier, I could have helped you.',
    ],
    [
      'Dù đã cố gắng hết sức, đội của chúng tôi vẫn thua.',
      'Despite trying our best, our team still lost.',
    ],
    [
      'Không phải lúc nào tiền cũng mang lại hạnh phúc.',
      "Money doesn't always bring happiness.",
    ],
    [
      'Tôi cần thời gian để cân nhắc lời đề nghị này.',
      'I need some time to think this offer over.',
    ],
    [
      'Lẽ ra dự án đã hoàn thành nếu chúng ta có đủ ngân sách.',
      'The project would have been finished if we had had enough budget.',
    ],
    [
      'Ngày càng nhiều người trẻ chọn làm việc tự do.',
      'More and more young people are choosing to work freelance.',
    ],
    [
      'Tôi rất tiếc vì đã không giữ lời hứa.',
      "I'm really sorry for not keeping my promise.",
    ],
    [
      'Điều khiến tôi ngạc nhiên là anh ấy chưa từng phàn nàn.',
      'What surprised me is that he has never complained.',
    ],
    [
      'Bạn nên đặt vé trước kẻo hết chỗ.',
      'You should book in advance in case it sells out.',
    ],
    [
      'Chúng tôi đang cân nhắc chuyển đến một căn hộ gần trung tâm hơn.',
      "We're considering moving to a flat closer to the city centre.",
    ],
  ],
  C1: [
    [
      'Hiếm khi nào tôi thấy một bài thuyết trình thuyết phục đến vậy.',
      'Rarely have I seen such a convincing presentation.',
    ],
    [
      'Xét cho cùng, sức khỏe quan trọng hơn sự nghiệp.',
      'At the end of the day, health matters more than a career.',
    ],
    [
      'Không đời nào tôi lại đồng ý với điều kiện như thế.',
      'There is no way I would agree to conditions like that.',
    ],
    [
      'Việc anh ấy từ chức không hề khiến ai bất ngờ.',
      'His resignation came as no surprise to anyone.',
    ],
    [
      'Lẽ ra chúng ta nên lường trước những rủi ro này ngay từ đầu.',
      'We should have anticipated these risks from the outset.',
    ],
    [
      'Bất kể bạn quyết định thế nào, tôi vẫn ủng hộ bạn.',
      "Whatever you decide, I'll still support you.",
    ],
    [
      'Chính sách mới được kỳ vọng sẽ giảm đáng kể ùn tắc giao thông.',
      'The new policy is expected to significantly reduce traffic congestion.',
    ],
    ['Nói thì dễ, làm mới khó.', 'Easier said than done.'],
    [
      'Tôi không thể không nghĩ rằng chúng ta đã bỏ lỡ điều gì đó.',
      "I can't help thinking that we've missed something.",
    ],
    [
      'Chỉ khi mất đi rồi người ta mới biết trân trọng.',
      'Only when we lose something do we truly appreciate it.',
    ],
  ],
}

/** [câu hỏi, câu trả lời mẫu] */
const QA: Record<ReflexLevel, Pair[]> = {
  A1: [
    ['Where are you from?', "I'm from Vietnam."],
    ['What do you do?', "I'm a student."],
    ['Do you have any brothers or sisters?', 'Yes, I have one older brother.'],
    ['What is your favourite food?', 'My favourite food is pho.'],
    ['What time do you get up?', 'I get up at six o’clock.'],
    ['Do you like music?', 'Yes, I love pop music.'],
    ['What colour is your bag?', 'My bag is black.'],
    ['How do you go to school?', 'I go to school by bike.'],
    ['What day is it today?', "It's Monday today."],
    ['Do you have a pet?', 'Yes, I have a cat.'],
  ],
  A2: [
    [
      'What did you do last weekend?',
      'I visited my grandparents and watched a film.',
    ],
    ['How often do you exercise?', 'I go jogging about three times a week.'],
    [
      'What are you going to do tonight?',
      "I'm going to cook dinner and relax.",
    ],
    [
      'What do you usually have for breakfast?',
      'I usually have bread and milk.',
    ],
    ['Have you ever travelled abroad?', 'Yes, I went to Thailand last year.'],
    ['What is your hometown like?', "It's a small, quiet town near the sea."],
    [
      'What do you like doing in your free time?',
      'I like reading and playing badminton.',
    ],
    [
      'Where did you go on your last holiday?',
      'I went to Da Lat with my family.',
    ],
    [
      'What kind of films do you like?',
      'I like comedies because they make me laugh.',
    ],
    ['Who is your best friend?', 'My best friend is Lan. We met at school.'],
  ],
  B1: [
    [
      'What would you do if you won the lottery?',
      "I'd buy a house for my parents and travel around the world.",
    ],
    [
      'What is the best way to learn a language?',
      'I think speaking every day with real people is the best way.',
    ],
    [
      'How has your city changed in recent years?',
      'There are many more tall buildings, but traffic has got worse.',
    ],
    [
      'Would you rather live in the city or the countryside?',
      "I'd rather live in the countryside because it's peaceful.",
    ],
    [
      'What skills do you want to improve this year?',
      'I want to improve my English speaking and time management.',
    ],
    [
      'Do you prefer working alone or in a team?',
      'I prefer working in a team because we can share ideas.',
    ],
    [
      'What is something you are proud of?',
      "I'm proud of finishing my first half marathon.",
    ],
    [
      'How do you usually deal with stress?',
      'I go for a walk or listen to music to calm down.',
    ],
    [
      'What makes a good teacher?',
      'A good teacher is patient and explains things clearly.',
    ],
    [
      'What advice would you give to a new student?',
      "Don't be afraid to ask questions.",
    ],
  ],
  B2: [
    [
      'Do you think social media does more harm than good?',
      'It depends on how you use it, but I think it often wastes our time.',
    ],
    [
      'Should university education be free?',
      'I believe it should, because education is an investment in society.',
    ],
    [
      'How will technology change the way we work?',
      'More people will work remotely and many routine jobs will be automated.',
    ],
    [
      'What are the pros and cons of working from home?',
      "You save commuting time, but it's harder to separate work and life.",
    ],
    [
      'Is it better to save money or to enjoy it now?',
      'I think a balance is best: save some, but enjoy life too.',
    ],
    [
      'Why do some people find it hard to change their habits?',
      'Habits are comfortable, so changing them takes real effort.',
    ],
    [
      'What makes a city a good place to live?',
      'Good public transport, clean air and green spaces.',
    ],
    [
      'How important is it to follow your passion in a career?',
      'It matters, but you also need to be realistic about income.',
    ],
    [
      'Should children be allowed to use smartphones?',
      'Yes, but with time limits and parental guidance.',
    ],
    [
      'What can individuals do to protect the environment?',
      'We can use less plastic and choose public transport.',
    ],
  ],
  C1: [
    [
      'To what extent should governments regulate artificial intelligence?',
      'Some regulation is essential to prevent misuse without stifling innovation.',
    ],
    [
      'Is globalisation a threat to local cultures?',
      'It can be, but it also gives local cultures a global audience.',
    ],
    [
      'Does success depend more on talent or hard work?',
      'Talent opens doors, but sustained effort is what keeps them open.',
    ],
    [
      'Should wealthy countries do more to tackle climate change?',
      'Yes, since they have contributed most to emissions historically.',
    ],
    [
      'How has remote work reshaped company culture?',
      "It's made culture more deliberate, since it no longer happens by accident.",
    ],
    [
      'Is it ever acceptable to tell a white lie?',
      'I think so, if it spares someone unnecessary hurt.',
    ],
    [
      'What role should museums play in modern society?',
      'They should make history accessible and spark public debate.',
    ],
    [
      'Are exams a fair way to measure ability?',
      'Not entirely; they reward test-taking skills as much as knowledge.',
    ],
    [
      'Should people be judged by their past mistakes?',
      'People deserve a chance to show that they have changed.',
    ],
    [
      'What is the biggest challenge facing your generation?',
      'Probably housing costs, which delay everything from marriage to starting a family.',
    ],
  ],
}

/** [tình huống tiếng Việt, câu mẫu] */
const SITUATION: Record<ReflexLevel, Pair[]> = {
  A1: [
    [
      'Bạn gặp đồng nghiệp vào buổi sáng. Chào họ.',
      'Good morning! How are you?',
    ],
    ['Bạn muốn gọi một ly trà sữa.', 'Can I have a milk tea, please?'],
    ['Ai đó cho bạn một món quà. Cảm ơn họ.', 'Thank you so much! I love it.'],
    ['Bạn vô tình giẫm vào chân người khác.', 'Oh, sorry! Are you OK?'],
    ['Bạn muốn biết giờ mở cửa của cửa hàng.', 'What time do you open?'],
    ['Bạn không nghe rõ người kia nói gì.', 'Sorry, can you say that again?'],
    ['Bạn tạm biệt bạn bè sau buổi đi chơi.', 'Bye! See you tomorrow.'],
    ['Bạn muốn mượn bút của bạn cùng lớp.', 'Can I borrow your pen?'],
    ['Bạn hỏi đường đến ga tàu.', 'Excuse me, where is the train station?'],
    [
      'Bạn giới thiệu bản thân với người mới.',
      "Hi, I'm Minh. Nice to meet you.",
    ],
  ],
  A2: [
    [
      'Bạn đến muộn cuộc hẹn 15 phút.',
      "Sorry I'm late. The traffic was terrible.",
    ],
    [
      'Món ăn bạn gọi bị nguội.',
      'Excuse me, my food is cold. Could you heat it up?',
    ],
    [
      'Bạn muốn mời đồng nghiệp đi ăn trưa.',
      'Would you like to have lunch with me?',
    ],
    [
      'Bạn muốn đổi chiếc áo vì nó quá chật.',
      "Can I change this shirt? It's too small.",
    ],
    [
      'Bạn bè rủ đi xem phim nhưng bạn bận.',
      "I'd love to, but I'm busy tonight. Maybe next time?",
    ],
    [
      'Bạn gọi điện đặt phòng khách sạn cho hai đêm.',
      "Hello, I'd like to book a room for two nights.",
    ],
    [
      'Bạn bị lạc và cần ai đó chỉ đường.',
      "Excuse me, I'm lost. Could you help me?",
    ],
    ['Người bạn của bạn trông có vẻ buồn.', 'Are you OK? You look a bit sad.'],
    [
      'Bạn muốn biết chuyến xe buýt tiếp theo khi nào đến.',
      'When is the next bus?',
    ],
    [
      'Bạn chúc mừng sinh nhật một người bạn.',
      'Happy birthday! I hope you have a great day.',
    ],
  ],
  B1: [
    [
      'Bạn làm vỡ cốc của đồng nghiệp.',
      "I'm so sorry, I broke your cup. I'll buy you a new one.",
    ],
    [
      'Hàng xóm mở nhạc quá to lúc nửa đêm.',
      'Sorry to bother you, but could you turn the music down a bit?',
    ],
    [
      'Bạn muốn xin nghỉ phép một ngày vì việc gia đình.',
      'Could I take a day off on Friday? I have a family matter.',
    ],
    [
      'Bạn nhận được hoá đơn sai ở nhà hàng.',
      'Excuse me, I think there is a mistake on the bill.',
    ],
    [
      'Đồng nghiệp xin ý kiến của bạn về bài thuyết trình.',
      'It was really clear. Maybe you could add a few more examples.',
    ],
    [
      'Bạn cần nhờ người lạ chụp ảnh giúp.',
      'Excuse me, would you mind taking a photo of us?',
    ],
    [
      'Bạn muốn từ chối lời mời làm thêm giờ một cách lịch sự.',
      "I'm afraid I can't stay late tonight. I already have plans.",
    ],
    [
      'Bạn được khen là nói tiếng Anh tốt.',
      "Thanks, that's kind of you. I've been practising a lot.",
    ],
    [
      'Chuyến bay của bạn bị huỷ, bạn hỏi nhân viên.',
      'My flight has been cancelled. What are my options?',
    ],
    [
      'Bạn quên mất tên người vừa gặp hôm trước.',
      "I'm sorry, I've forgotten your name. Could you remind me?",
    ],
  ],
  B2: [
    [
      'Sếp giao thêm việc trong khi bạn đã quá tải.',
      "I'd like to help, but I'm already at full capacity. Could we reprioritise?",
    ],
    [
      'Bạn cần nhắc khéo đồng nghiệp trả lời email gấp.',
      'Just following up on my email — could you get back to me by today?',
    ],
    [
      'Bạn không đồng ý với ý kiến trong cuộc họp.',
      'I see your point, but I have a slightly different view.',
    ],
    [
      'Khách hàng phàn nàn rằng hàng giao trễ.',
      "I'm really sorry for the delay. Let me check what happened and get back to you.",
    ],
    [
      'Bạn muốn thương lượng giảm giá tiền thuê nhà.',
      "I'm happy to sign a longer lease if we could lower the rent a little.",
    ],
    [
      'Bạn cần dừng cuộc họp kéo dài quá giờ.',
      "Sorry to interrupt, but we're running over time. Shall we wrap up?",
    ],
    [
      'Bạn đưa ra nhận xét chưa tốt cho cấp dưới.',
      "Overall it's good work, but the report needs more data to support it.",
    ],
    [
      'Bạn đi phỏng vấn và được hỏi điểm yếu.',
      'I sometimes take on too much, so I’m learning to delegate more.',
    ],
    [
      'Bạn phải hoãn cuộc hẹn đã lên lịch với đối tác.',
      'Something urgent has come up. Would it be possible to reschedule?',
    ],
    [
      'Bạn bè xin lời khuyên có nên nghỉ việc không.',
      "If you're unhappy, it might be worth looking around before you quit.",
    ],
  ],
  C1: [
    [
      'Bạn cần báo tin dự án bị cắt ngân sách cho cả nhóm.',
      "I'm afraid I have some disappointing news: our budget has been cut.",
    ],
    [
      'Đối tác đưa ra yêu cầu vô lý, bạn từ chối khéo.',
      "I understand why you'd ask, but that's not something we can commit to.",
    ],
    [
      'Bạn phải xin lỗi khách hàng vì một sai sót nghiêm trọng.',
      'We take full responsibility for the error, and we are putting measures in place so it does not happen again.',
    ],
    [
      'Bạn muốn phản biện một số liệu trong báo cáo của sếp.',
      "I may be wrong, but these figures don't seem to match last quarter's data.",
    ],
    [
      'Bạn điều phối hai đồng nghiệp đang tranh cãi.',
      "Let's take a step back and look at what we both agree on.",
    ],
    [
      'Bạn được mời phát biểu bất ngờ tại tiệc cưới bạn thân.',
      "I wasn't expecting to speak, but I can't let this moment pass without saying how happy I am for you both.",
    ],
    [
      'Bạn đàm phán lương khi nhận lời mời làm việc.',
      'I am very excited about the role, but I was hoping for a salary closer to my current package.',
    ],
    [
      'Bạn cần nói “không” với một người bạn nhờ vay tiền.',
      "I really wish I could help, but I'm not in a position to lend money right now.",
    ],
    [
      'Bạn trình bày vấn đề nhạy cảm với ban giám đốc.',
      "I'd like to raise a concern that may be uncomfortable, but I think it needs addressing.",
    ],
    [
      'Bạn tóm tắt kết luận cuối cuộc họp.',
      'To sum up, we have agreed on the timeline, and the next step is to confirm the budget.',
    ],
  ],
}

const PATTERN: Record<ReflexLevel, Drill[]> = {
  A1: [
    ['I like ___.', 'play football', 'I like playing football.'],
    [
      'Can I have ___, please?',
      'a glass of water',
      'Can I have a glass of water, please?',
    ],
    [
      'There is ___ in my room.',
      'a big window',
      'There is a big window in my room.',
    ],
    ["I don't ___.", 'eat meat', "I don't eat meat."],
    ['Where is ___?', 'the post office', 'Where is the post office?'],
    ['I have ___.', 'two cats', 'I have two cats.'],
    ['My ___ is ___.', 'sister / a nurse', 'My sister is a nurse.'],
    ['I want to ___.', 'go home', 'I want to go home.'],
    ['Do you ___?', 'speak English', 'Do you speak English?'],
    ["Let's ___.", 'go to the park', "Let's go to the park."],
  ],
  A2: [
    ["I'm going to ___.", 'visit my grandma', "I'm going to visit my grandma."],
    ['I have never ___.', 'eaten sushi', 'I have never eaten sushi.'],
    ['How about ___?', 'watch a film', 'How about watching a film?'],
    [
      'I usually ___ after work.',
      'go to the gym',
      'I usually go to the gym after work.',
    ],
    [
      'It takes me ___ to ___.',
      '30 minutes / get to work',
      'It takes me 30 minutes to get to work.',
    ],
    [
      "I'm interested in ___.",
      'learn Japanese',
      "I'm interested in learning Japanese.",
    ],
    ['Would you like ___?', 'some tea', 'Would you like some tea?'],
    [
      'I was ___ when ___.',
      'cooking / you called',
      'I was cooking when you called.',
    ],
    [
      '___ is better than ___.',
      'the bus / the taxi',
      'The bus is better than the taxi.',
    ],
    [
      'I need to ___ before ___.',
      'finish this / lunch',
      'I need to finish this before lunch.',
    ],
  ],
  B1: [
    [
      "I'd rather ___ than ___.",
      'stay home / go out',
      "I'd rather stay home than go out.",
    ],
    [
      'If I were you, I would ___.',
      'talk to the manager',
      'If I were you, I would talk to the manager.',
    ],
    [
      "I've been ___ since ___.",
      'working here / 2020',
      "I've been working here since 2020.",
    ],
    ['Do you mind ___?', 'close the door', 'Do you mind closing the door?'],
    [
      "I'm looking forward to ___.",
      'see you',
      "I'm looking forward to seeing you.",
    ],
    [
      'It was so ___ that ___.',
      'hot / we stayed inside',
      'It was so hot that we stayed inside.',
    ],
    [
      'I used to ___, but now ___.',
      'smoke / I exercise',
      'I used to smoke, but now I exercise.',
    ],
    [
      'You should have ___.',
      'told me earlier',
      'You should have told me earlier.',
    ],
    ['I wish I could ___.', 'speak French', 'I wish I could speak French.'],
    [
      'The reason why ___ is that ___.',
      "I'm late / my car broke down",
      "The reason why I'm late is that my car broke down.",
    ],
  ],
  B2: [
    [
      'If I had ___, I would have ___.',
      'known / helped you',
      'If I had known, I would have helped you.',
    ],
    [
      'Not only ___, but also ___.',
      'is she smart / she is kind',
      'Not only is she smart, but she is also kind.',
    ],
    [
      "It's high time we ___.",
      'start the project',
      "It's high time we started the project.",
    ],
    [
      'No matter how ___, ___.',
      'hard it is / I will try',
      'No matter how hard it is, I will try.',
    ],
    [
      'I would appreciate it if you could ___.',
      'send me the file',
      'I would appreciate it if you could send me the file.',
    ],
    [
      '___ is said to be ___.',
      'this restaurant / the best in town',
      'This restaurant is said to be the best in town.',
    ],
    [
      'Had I ___, I would ___.',
      'left earlier / not have missed the train',
      'Had I left earlier, I would not have missed the train.',
    ],
    [
      'The more ___, the ___.',
      'you read / more you learn',
      'The more you read, the more you learn.',
    ],
    ['I am considering ___.', 'change jobs', 'I am considering changing jobs.'],
    [
      '___ as long as ___.',
      'you can borrow it / you return it',
      'You can borrow it as long as you return it.',
    ],
  ],
  C1: [
    ['Rarely do ___.', 'we see such talent', 'Rarely do we see such talent.'],
    [
      'Were it not for ___, ___.',
      'your help / we would have failed',
      'Were it not for your help, we would have failed.',
    ],
    [
      "What I can't stand is ___.",
      'people being late',
      "What I can't stand is people being late.",
    ],
    [
      'It is essential that ___.',
      'everyone attend the meeting',
      'It is essential that everyone attend the meeting.',
    ],
    [
      'Only after ___ did ___.',
      'the meeting / I realise the problem',
      'Only after the meeting did I realise the problem.',
    ],
    [
      'Little did ___ know that ___.',
      'she / she had won',
      'Little did she know that she had won.',
    ],
    [
      '___ notwithstanding, ___.',
      'the cost / it was worth it',
      'The cost notwithstanding, it was worth it.',
    ],
    [
      'Be that as it may, ___.',
      'we still need a decision',
      'Be that as it may, we still need a decision.',
    ],
    [
      'Should you ___, please ___.',
      'have any questions / contact me',
      'Should you have any questions, please contact me.',
    ],
    [
      'It goes without saying that ___.',
      'safety comes first',
      'It goes without saying that safety comes first.',
    ],
  ],
}

export function bankPrompts(
  mode: ReflexMode,
  level: ReflexLevel,
): ReflexPrompt[] {
  if (mode === 'pattern')
    return PATTERN[level].map(([prompt, hint, reference]) => ({
      prompt,
      promptLang: 'en',
      hint,
      reference,
    }))
  const src = { translate: TRANSLATE, qa: QA, situation: SITUATION }[mode]
  return src[level].map(([prompt, reference]) => ({
    prompt,
    promptLang: mode === 'qa' ? 'en' : 'vi',
    reference,
  }))
}

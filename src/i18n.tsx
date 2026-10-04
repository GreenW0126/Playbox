import { cloneElement, isValidElement, type ReactNode } from 'react';

export type Language = 'en' | 'zh';

const zh: Record<string, string> = {
  'Who are you for this session?': '这次你要进入哪个角色？',
  'Choose which actions belong inside this frame.': '选择这段时间要专注的角色。',
  Student: '学生',
  Researcher: '研究员',
  Employee: '职场人士',
  Athlete: '运动员',
  'Learn and practise': '学习与练习',
  'Read, examine, connect': '阅读、分析与写作',
  'Make and deliver': '创造与交付',
  'Train and recover': '训练与放松',
  'Session notebook': '专注记录',
  'SESSION HISTORY': '专注历史',
  'SESSION NOTEBOOK': '专注记录',
  'Repeated sessions gather under one task.': '同一任务的多次专注会汇总在一起。',
  Session: '专注',
  of: '/',
  sessions: '次专注',
  'Task completed': '任务已完成',
  'Frame completed': '本次专注已完成',
  'No mini blocks recorded': '没有记录迷你区块',
  'Interrupted by reality': '被现实打断',
  'Your completed sessions will appear here.': '完成的专注记录会出现在这里。',
  'CHOOSE A TASK': '选择任务',
  'Start from what you actually want to work on.': '从你真正想推进的事情开始。',
  'What are you working on?': '你要做什么？',
  'Recent tasks': '最近的任务',
  Essay: '论文',
  'Language Learning': '语言学习',
  Reading: '阅读',
  'Exam Practice': '模拟考试',
  'Desk Research': '桌面研究',
  'Literature Review': '文献综述',
  Analysis: '分析',
  Writing: '写作',
  'Desk Work': '信息整理',
  'Project Work': '项目',
  Meeting: '会议',
  Presentation: '演示文稿',
  Relief: '舒缓',
  Strength: '力量训练',
  'Wind Down': '放松',
  Recovery: '恢复',
  Back: '返回',
  Continue: '下一步',
  'SET A DURATION': '设定时长',
  'Choose how long you want to stay with it.': '选择你要投入多长时间。',
  'How long?': '专注多久？',
  min: '分钟',
  Custom: '自定义',
  'Enter minutes': '输入分钟数',
  'Ends at': '结束时间',
  'PREPARE YOUR SPACE': '准备空间',
  'Keep only what you need in view.': '视线内只留下任务所需的东西。',
  'Clear your view for this task.': '为当前任务创造专注空间。',
  'Anything inside the frame may ask for your attention.': '视野里的每样东西都可能分散注意力。',
  'Keep only what this task needs.': '只留下当前任务需要的东西。',
  'Yoga mat, dumbbells, resistance band and water bottle inside a visual reference frame': '视觉边框内放有瑜伽垫、哑铃、弹力带和水瓶',
  'Laptop, notebook, pen and desk lamp inside a visual reference frame': '视觉边框内放有笔记本电脑、笔记本、笔和台灯',
  'Sound environment': '声音环境',
  Off: '关闭',
  "On — I'll manage it outside Playbox": '开启——我会在 Playbox 外播放',
  'Skip this step': '跳过此步骤',
  'Looks good': '准备好了',
  'READY TO START': '准备开始',
  'Confirm and enter your session.': '确认后进入专注时段。',
  'External playlist environment': '使用外部播放列表',
  'Focused workspace ready': '专注空间已准备好',
  'Space check skipped': '已跳过环境准备',
  'Start session': '开始专注',
  'in this session': '本次专注剩余',
  'Time remaining': '剩余时间',
  'Current session': '当前专注',
  'Current mini block': '当前迷你区块',
  'Complete mini block': '完成迷你区块',
  'Go without mini-block': '不使用迷你区块',
  'Return': '返回',
  Paused: '已暂停',
  Mobility: '灵活性',
  'Full Body': '全身',
  'Upper Body': '上肢',
  'Lower Body': '下肢',
  'Neck & Shoulders': '颈部与肩部',
  Wrists: '手腕',
  'Gentle Stretch': '轻柔拉伸',
  Breathwork: '呼吸练习',
  'Bedtime Mobility': '睡前活动',
  'Active Recovery': '主动恢复',
  'Joint Mobility': '关节活动',
  'Full Body Reset': '全身重置',
  'SESSION COMPLETE': '专注完成',
  'A clear and satisfying closure.': '清晰、完整地结束。',
  'Session complete.': '本次专注完成。',
  "That's enough for now. Take a break. You've earned it.": '去放空吧，你应得的。',
  Close: '结束',
  'RECOVERY PERIOD': '恢复时间',
  'No immediate restart.': '不要立刻重新开始。',
  'Next session won’t be available until 5 min.': '5 分钟后才能开始下一次专注。',
  Now: '现在',
  'exhale.': '呼气。',
  'Focus is finite.': '专注力是有限的。',
  'Working is like breathing.': '像呼吸一样工作。',
  'Return to': '返回',
  'READY AGAIN': '再次准备好',
  'Start a new session when you are ready.': '准备好后，开始新的专注。',
  'Ready when you are.': '等你准备好。',
  'Start a new session': '开始新的专注',
  Language: '语言',
};

export function translateText(value: string, language: Language): string {
  if (language === 'en') return value;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const text = value.trim();
  if (!text) return value;
  if (zh[text]) return `${leading}${zh[text]}${trailing}`;

  let match = text.match(/^(.*) · (\d+) completed (?:session|sessions)\.$/);
  if (match) return `${leading}${match[1]} · 已完成 ${match[2]} 次专注。${trailing}`;
  match = text.match(/^(\d+) of (\d+) min$/);
  if (match) return `${leading}已专注 ${match[1]} / ${match[2]} 分钟${trailing}`;
  match = text.match(/^\(in (\d+) min\)$/);
  if (match) return `${leading}（${match[1]} 分钟后）${trailing}`;
  match = text.match(/^(\d+) min remaining$/);
  if (match) return `${leading}剩余 ${match[1]} 分钟${trailing}`;
  match = text.match(/^(\d+) min$/);
  if (match) return `${leading}${match[1]} 分钟${trailing}`;
  match = text.match(/^Open (.*) session history$/);
  if (match) return `${leading}打开 ${match[1]} 的专注记录${trailing}`;
  return value;
}

const translatableProps = ['placeholder', 'aria-label', 'alt', 'title', 'value'] as const;

export function localizeNode(node: ReactNode, language: Language): ReactNode {
  if (language === 'en' || node == null || typeof node === 'boolean' || typeof node === 'number') return node;
  if (typeof node === 'string') return translateText(node, language);
  if (Array.isArray(node)) return node.map(child => localizeNode(child, language));
  if (!isValidElement<Record<string, unknown>>(node)) return node;

  const nextProps: Record<string, unknown> = {};
  const children = node.props.children as ReactNode;
  if ('children' in node.props) nextProps.children = localizeNode(children, language);
  translatableProps.forEach(prop => {
    const value = node.props[prop];
    if (typeof value === 'string') nextProps[prop] = translateText(value, language);
  });
  return cloneElement(node, nextProps);
}

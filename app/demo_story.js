/* First playable narrative slice: The Lost Road.
 * Session-scoped progress. This module owns story progression and journal rendering;
 * the game world remains free-roam and all non-story landmarks stay optional.
 */
(() => {
  'use strict';

  const chapters = [
    {
      id: 'village', place: '林息村', title: '路标背面的刻痕',
      objective: '检查林息村的旧路标',
      entry: '石碑正面的村名已经风化。翻到背面，你发现一行被苔藓遮住的字：雾桥仍记得归路。',
      journal: '林息村的旧路标提到了“雾桥”。这条古道似乎并非通往村庄，而是从村庄继续深入森林。'
    },
    {
      id: 'bridge', place: '雾桥古道', title: '桥下的第二行字',
      objective: '寻找雾桥石栏上的古代文字',
      entry: '桥下的石缝里刻着第二行字：当河水转向，九声低语会指向旧城。',
      journal: '桥下的刻文提到“九声低语”和一座旧城。河流、石柱与古道之间存在联系。'
    },
    {
      id: 'grove', place: '低语林庭', title: '九根石柱',
      objective: '调查低语林庭中央的树根祭坛',
      entry: '九根石柱并非随意排列。风穿过石柱时，祭坛下传来短促的回响，像是在重复一个名字：断城。',
      journal: '低语林庭的石柱组成了某种声学结构。祭坛的回响指向树海断城。'
    },
    {
      id: 'ruins', place: '树海断城', title: '没有写完的壁画',
      objective: '寻找树海断城中保存最完整的壁画',
      entry: '壁画描绘着人们沿着树根修筑道路。最后一幅被人为刮去，只剩一棵巨树和一句话：道路会在根醒来时继续。',
      journal: '古代居民似乎没有离开森林。他们把道路修向了一棵巨树。壁画所指的地方可能是千冠母树。'
    },
    {
      id: 'mother', place: '千冠母树', title: '树根之下',
      objective: '观察千冠母树裸露的主根',
      entry: '巨树的主根围出一道狭窄的入口。石面上的纹路与雾桥刻文完全一致。古道没有消失，它通向地下。',
      journal: '古道的终点不是一座城市，而是地下的根脉通道。入口附近的晶脉与根脉洞穴相连。'
    },
    {
      id: 'cave', place: '根脉洞穴', title: '古道仍在延伸',
      objective: '进入根脉洞穴，确认古道的去向',
      entry: '晶脉照亮了被泥土掩埋的石阶。石阶向更深处延伸，尽头传来风声。你找到的不是道路的终点，而是下一段旅程的入口。',
      journal: '雾隐树海的古道仍然存在。它通往尚未探索的地下世界。第一段旅程结束了。'
    }
  ];

  function create() {
    let chapter = 0;
    const notes = [];
    const earlyVisits = new Set();
    let completed = false;

    function getState() {
      const current = chapters[Math.min(chapter, chapters.length - 1)];
      return {
        chapter,
        total: chapters.length,
        completed,
        currentPlace: completed ? '旅程暂告一段落' : current.place,
        objective: completed ? '带着新的发现，继续自己的旅行' : current.objective,
        notes: notes.map((note, index) => ({ ...note, number: index + 1 })),
        earlyVisits: [...earlyVisits]
      };
    }

    function visit(id) {
      const index = chapters.findIndex(item => item.id === id);
      if (index < 0 || completed) return null;

      if (index < chapter) return { type: 'repeat' };

      if (index > chapter) {
        earlyVisits.add(id);
        return {
          type: 'unresolved',
          title: chapters[index].place,
          text: '这里似乎藏着一条重要线索，但目前还缺少能够解释它的前文。先把已经发现的线索串联起来。'
        };
      }

      const item = chapters[index];
      notes.push({ place: item.place, title: item.title, text: item.journal });
      chapter += 1;
      completed = chapter >= chapters.length;
      return {
        type: completed ? 'complete' : 'clue',
        title: item.title,
        text: item.entry,
        nextObjective: completed ? '带着新的发现，继续自己的旅行' : chapters[chapter].objective,
        progress: chapter,
        total: chapters.length
      };
    }

    function render() {
      const state = getState();
      const objective = document.getElementById('journeyObjective');
      const objectivePlace = document.getElementById('journeyPlace');
      const objectiveText = document.getElementById('journeyText');
      const progress = document.getElementById('journeyProgress');
      const journal = document.getElementById('journalEntries');
      const journalCount = document.getElementById('journalCount');
      const journalStatus = document.getElementById('journalStatus');

      if (objectivePlace) objectivePlace.textContent = state.currentPlace;
      if (objectiveText) objectiveText.textContent = state.objective;
      if (progress) progress.style.width = (state.chapter / state.total * 100) + '%';
      if (journalCount) journalCount.textContent = state.notes.length + ' / ' + state.total + ' 条记录';
      if (journalStatus) journalStatus.textContent = state.completed
        ? '第一段旅程已完成 · 古道仍在延伸'
        : '线索 ' + state.chapter + ' / ' + state.total;

      if (journal) {
        journal.innerHTML = state.notes.length
          ? state.notes.map(note => '<article class="journalEntry"><small>记录 ' + String(note.number).padStart(2, '0') + ' · ' + note.place + '</small><h4>' + note.title + '</h4><p>' + note.text + '</p></article>').join('')
          : '<div class="journalEmpty">手记仍是空白。先从林息村的旧路标开始，世界会慢慢留下线索。</div>';
      }

      if (objective) objective.classList.toggle('complete', state.completed);
    }

    return { getState, visit, render };
  }

  window.DemoStory = { create };
})();

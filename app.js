(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const titleFont = '400 64px "AaXinhuaJingma"';
  const titleFontSample = "海风有了形状乡音有了信使";
  const performanceLite = reducedMotion
    || window.innerWidth <= 760
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory && navigator.deviceMemory <= 4);

  document.documentElement.classList.toggle("performance-lite", Boolean(performanceLite));

  async function revealTitlesWithOriginalFont() {
    if (!document.fonts) return false;
    try {
      await document.fonts.load(titleFont, titleFontSample);
      await document.fonts.ready;
      if (document.fonts.check(titleFont, titleFontSample)) {
        document.documentElement.classList.add("title-font-ready");
        return true;
      }
    } catch (error) {
      console.error("标题字体加载失败", error);
    }
    return false;
  }

  const titleFontReady = revealTitlesWithOriginalFont();

  const welcome = $("#welcome");
  const activityHub = $("#activityHub");
  const activityModal = $("#activityModal");
  const appShell = $("#appShell");
  const scrollWorld = $("#scrollWorld");
  const sections = [$("#write"), $("#sail"), $("#wall")];
  const navItems = $$(".stage-nav__item");
  const prevStage = $("#prevStage");
  const nextStage = $("#nextStage");
  const toast = $("#toast");
  const backgroundMusic = $("#backgroundMusic");
  let currentStage = 0;
  let toastTimer;
  let currentLetter = null;
  let posterReady = false;
  let audioContext = null;
  let musicMaster = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicPlaying = false;
  let musicStartPending = false;
  let seaNoise = null;
  let welcomeStoryStep = 0;
  let welcomeEarnedStep = 0;
  let welcomeStoryTimer = null;
  let hubSceneTimers = [];
  let feedCount = 0;
  let tideCount = 0;
  let activeDetailLetter = null;
  let galleryLetters = [];

  const welcomeStoryStops = [
    {
      kicker: "信使诞生",
      title: "海风有了形状<br /><em>乡音有了信使</em>",
      copy: "纸舟为冠，海浪为发。海浪信使从漳浦的历史与潮声中醒来，带着没有边界的牵挂，踏上沿海打卡之旅。",
      x: "13%",
      y: "74%",
    },
    {
      kicker: "火山岛打卡",
      title: "玄武岩写下年轮<br /><em>海浪读懂时间</em>",
      copy: "火山岛的黑色岩层，是海与火共同留下的档案。信使获得第二枚纪念章，也记住了漳浦面向海洋的勇气。",
      x: "41%",
      y: "55%",
    },
    {
      kicker: "六鳌打卡",
      title: "金色西沙醒来<br /><em>风把脚印连成路</em>",
      copy: "日出越过六鳌翡翠湾，金色沙滩把乡音送向远方。第三枚纪念章落入信袋，龙美湾已在前方。",
      x: "70%",
      y: "48%",
    },
    {
      kicker: "龙美湾会合",
      title: "一湾山海相连<br /><em>双IP终于相遇</em>",
      copy: "最后一站抵达龙美湾。海浪信使遇见从纸笺与岩石中诞生的岩笺，一段连接闽台游子与故乡的新旅程由此开始。",
      x: "89%",
      y: "30%",
    },
  ];

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function renderWelcomeStory(step) {
    welcomeStoryStep = clamp(step, 0, welcomeStoryStops.length - 1);
    welcomeEarnedStep = Math.max(welcomeEarnedStep, welcomeStoryStep);
    const story = welcomeStoryStops[welcomeStoryStep];
    $("#welcomeStoryIndex").textContent = String(welcomeStoryStep + 1).padStart(2, "0");
    $("#welcomeStoryKicker").textContent = story.kicker;
    $("#welcomeStoryTitle").innerHTML = story.title;
    $("#welcomeStoryCopy").textContent = story.copy;
    $("#welcomeStampCount").textContent = welcomeEarnedStep + 1;
    $("#welcomeProgressBar").style.width = `${(welcomeEarnedStep + 1) * 25}%`;
    $("#welcomeProgressText").textContent = welcomeEarnedStep === 3 ? "打卡完成 · 点击纪念章回看" : `打卡路线加载 ${(welcomeEarnedStep + 1) * 25}%`;
    $$(".welcome-stop").forEach((stop, index) => {
      const current = index === welcomeStoryStep;
      stop.classList.toggle("is-earned", index <= welcomeEarnedStep);
      stop.classList.toggle("is-current", current);
      stop.setAttribute("aria-pressed", String(current));
    });
    $$("[data-stamp]").forEach((stamp, index) => {
      const current = index === welcomeStoryStep;
      stamp.classList.toggle("is-earned", index <= welcomeEarnedStep);
      stamp.classList.toggle("is-current", current);
      stamp.setAttribute("aria-pressed", String(current));
    });
    const pulse = $(".welcome-map__pulse");
    pulse.style.left = story.x;
    pulse.style.top = story.y;
    welcome.classList.toggle("is-meeting", welcomeStoryStep === 3);
  }

  function selectWelcomeStory(step) {
    clearInterval(welcomeStoryTimer);
    renderWelcomeStory(step);
    const copy = $(".welcome-story__copy");
    copy.classList.remove("is-story-switching");
    void copy.offsetWidth;
    copy.classList.add("is-story-switching");
    setTimeout(() => copy.classList.remove("is-story-switching"), 620);
  }

  $$("[data-stamp], [data-stop]").forEach((control) => {
    control.addEventListener("click", () => {
      const step = Number(control.dataset.stamp ?? control.dataset.stop);
      selectWelcomeStory(step);
      showToast(`已打开「${welcomeStoryStops[step].kicker}」纪念章`);
    });
  });

  function startWelcomeStory() {
    clearInterval(welcomeStoryTimer);
    welcomeStoryTimer = setInterval(() => {
      if (welcomeStoryStep >= welcomeStoryStops.length - 1) {
        clearInterval(welcomeStoryTimer);
        return;
      }
      renderWelcomeStory(welcomeStoryStep + 1);
    }, 1650);
  }

  function playHubSceneIntro() {
    hubSceneTimers.forEach(clearTimeout);
    hubSceneTimers = [];
    const scenes = [
      [0, "01", "日出金海"],
      [1500, "02", "金色西沙海滩"],
      [3100, "03", "龙美湾景区地图"],
    ];
    scenes.forEach(([delay, index, label]) => {
      hubSceneTimers.push(setTimeout(() => {
        $("#hubSceneIndex").textContent = index;
        $("#hubSceneLabel").textContent = label;
      }, delay));
    });
  }

  function showActivityHub(fromWelcome = false) {
    if (fromWelcome) welcome.classList.add("is-entering");
    activityModal.classList.remove("is-open");
    activityModal.setAttribute("aria-hidden", "true");
    appShell.classList.remove("is-visible");
    appShell.setAttribute("aria-hidden", "true");
    activityHub.classList.add("is-visible");
    activityHub.setAttribute("aria-hidden", "false");
    activityHub.scrollTop = 0;
    playHubSceneIntro();
  }

  function enterExperience() {
    clearInterval(welcomeStoryTimer);
    showActivityHub(true);
    startMusic();
  }

  function openLetterNavigation() {
    activityModal.classList.remove("is-open");
    activityModal.setAttribute("aria-hidden", "true");
    activityHub.classList.remove("is-visible");
    activityHub.setAttribute("aria-hidden", "true");
    appShell.classList.add("is-visible");
    appShell.setAttribute("aria-hidden", "false");
    goToStage(0);
    startMusic();
    setTimeout(() => $("#senderName").focus({ preventScroll: true }), 850);
  }

  $("#enterExperience").addEventListener("click", enterExperience);
  $("#skipWelcome").addEventListener("click", enterExperience);
  $("#hubLetterNav").addEventListener("click", openLetterNavigation);
  $("#openLetterExperience").addEventListener("click", openLetterNavigation);

  const activityMeta = {
    map: ["漳浦沿海打卡图", "每到一处获得一枚纪念章，最后在龙美湾完成双IP会合"],
    peacock: ["双IP饲养孔雀", "轻触投喂谷粒，看看海浪信使与岩笺如何回应"],
    gallery: ["岩蚀画廊猜画", "从天然石纹中辨认海洋意象，猜中即可进入导航2"],
    tide: ["双IP赶海活动", "在潮水回来前，收集四件潮间带记忆"],
  };

  function openActivity(name) {
    const meta = activityMeta[name] || activityMeta.map;
    $("#activityTitle").textContent = meta[0];
    $("#activitySubtitle").textContent = meta[1];
    $$('[data-activity-panel]').forEach((panel) => { panel.hidden = panel.dataset.activityPanel !== name; });
    activityModal.classList.add("is-open");
    activityModal.setAttribute("aria-hidden", "false");
  }

  function closeActivity() {
    activityModal.classList.remove("is-open");
    activityModal.setAttribute("aria-hidden", "true");
    activityHub.scrollTop = 0;
  }

  $$('[data-activity]').forEach((button) => button.addEventListener("click", () => openActivity(button.dataset.activity)));
  $$('[data-close-activity]').forEach((button) => button.addEventListener("click", closeActivity));

  $$('[data-discovery-mode]').forEach((button) => button.addEventListener("click", () => {
    $$('[data-discovery-mode]').forEach((item) => item.classList.toggle("is-active", item === button));
    const mode = button.dataset.discoveryMode;
    if (mode === "explorer") {
      const activities = ["peacock", "gallery", "tide"];
      const choice = activities[Math.floor(Math.random() * activities.length)];
      $("#hubMascotSpeech").textContent = `偶遇一条新线索：${activityMeta[choice][0]}`;
      setTimeout(() => openActivity(choice), 380);
    } else if (mode === "searcher") {
      $("#hubMascotSpeech").textContent = "去公共岩壁，寻找一个名字。";
      openLetterNavigation();
      setTimeout(() => {
        goToStage(2);
        $("#wallSearch").focus({ preventScroll: true });
      }, 720);
    } else {
      $("#hubMascotSpeech").textContent = "跟着纪念章，沿漳浦海岸前行。";
      setTimeout(() => openActivity("map"), 280);
    }
  }));

  const museumCursor = $("#museumCursor");
  if (window.matchMedia("(pointer: fine)").matches && !performanceLite) {
    document.documentElement.classList.add("has-museum-cursor");
    let cursorFrame = 0;
    let cursorX = 0;
    let cursorY = 0;
    document.addEventListener("pointermove", (event) => {
      cursorX = event.clientX;
      cursorY = event.clientY;
      if (cursorFrame) return;
      cursorFrame = requestAnimationFrame(() => {
        museumCursor.style.setProperty("--cursor-x", `${cursorX}px`);
        museumCursor.style.setProperty("--cursor-y", `${cursorY}px`);
        cursorFrame = 0;
      });
    }, { passive: true });
    document.addEventListener("pointerover", (event) => {
      const interactive = event.target.closest("button, a, .rock-letter, input, textarea");
      museumCursor.classList.toggle("is-active", Boolean(interactive));
      museumCursor.querySelector("span").textContent = interactive?.closest(".rock-letter") ? "阅信" : interactive ? "进入" : "探索";
    });
  }

  if (!performanceLite) {
    let hubPointerFrame = 0;
    let hubPointerX = 0;
    let hubPointerY = 0;
    activityHub.addEventListener("pointermove", (event) => {
      hubPointerX = event.clientX;
      hubPointerY = event.clientY;
      if (hubPointerFrame) return;
      hubPointerFrame = requestAnimationFrame(() => {
        const x = (hubPointerX / Math.max(1, window.innerWidth) - 0.5) * 2;
        const y = (hubPointerY / Math.max(1, window.innerHeight) - 0.5) * 2;
        activityHub.style.setProperty("--hub-shift-x", `${(x * 13).toFixed(2)}px`);
        activityHub.style.setProperty("--hub-shift-y", `${(y * 8).toFixed(2)}px`);
        activityHub.style.setProperty("--hub-shift-bg-x", `${(x * -5).toFixed(2)}px`);
        activityHub.style.setProperty("--hub-shift-bg-y", `${(y * -3).toFixed(2)}px`);
        hubPointerFrame = 0;
      });
    }, { passive: true });
  }

  $$(".activity-dock button").forEach((card) => {
    if (performanceLite) return;
    let tiltFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    card.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (tiltFrame) return;
      tiltFrame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--tilt-x", `${((pointerY - rect.top) / rect.height - 0.5) * -7}deg`);
        card.style.setProperty("--tilt-y", `${((pointerX - rect.left) / rect.width - 0.5) * 9}deg`);
        tiltFrame = 0;
      });
    });
    card.addEventListener("pointerleave", () => {
      if (tiltFrame) cancelAnimationFrame(tiltFrame);
      tiltFrame = 0;
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
    });
  });
  $("#returnActivities").addEventListener("click", () => {
    showActivityHub(false);
    setTimeout(() => openActivity("tide"), 420);
  });

  $("#feedPeacock").addEventListener("click", () => {
    feedCount = Math.min(3, feedCount + 1);
    $("#feedCount").textContent = feedCount;
    const moods = ["孔雀轻轻点头，岩笺笑弯了眼。", "孔雀展开尾羽，信使举起第二把谷粒！", "投喂完成，双IP获得「友善同行」印章。"];
    $("#peacockMood").textContent = moods[feedCount - 1];
    const pair = $(".activity-mascot-pair");
    pair.classList.add("is-excited");
    setTimeout(() => pair.classList.remove("is-excited"), 460);
    if (feedCount === 3) {
      $("#feedPeacock").querySelector("span").textContent = "今日投喂完成";
      $("#feedPeacock").disabled = true;
      showToast("孔雀开屏 · 获得友善同行纪念章");
    }
  });

  $$('[data-riddle]').forEach((button) => button.addEventListener("click", () => {
    $$('[data-riddle]').forEach((item) => item.classList.remove("is-correct", "is-wrong"));
    const correct = button.dataset.riddle === "bird";
    button.classList.add(correct ? "is-correct" : "is-wrong");
    $("#riddleFeedback").textContent = correct ? "猜中了！两侧石脊像展开的翅膀。把这份观察带进导航2，写成一封海峡家书吧。" : "再看一次：中央像身体，两侧轮廓向外展开。";
    $("#riddleToLetter").hidden = !correct;
  }));
  $("#riddleToLetter").addEventListener("click", openLetterNavigation);

  function resetTideGame() {
    tideCount = 0;
    $("#tideCount").textContent = "0";
    $("#tideHint").textContent = "赶在潮水回来前，点亮四件海边小物。";
    $$("[data-tide-item]").forEach((item) => item.classList.remove("is-collected"));
  }

  $$("[data-tide-item]").forEach((item) => item.addEventListener("click", () => {
    if (item.classList.contains("is-collected")) return;
    item.classList.add("is-collected");
    tideCount += 1;
    $("#tideCount").textContent = tideCount;
    $("#tideHint").textContent = `找到「${item.dataset.tideItem}」——潮间带记忆 ${tideCount}/4`;
    if (tideCount === 4) {
      $("#tideHint").textContent = "赶海完成！漂流信笺正等你写下闽台乡音。";
      showToast("潮间记忆已收集 · 可以进入导航2寄信");
    }
  }));
  $("#resetTide").addEventListener("click", resetTideGame);

  $("#showEnding").addEventListener("click", () => {
    $("#sunsetEnding").classList.add("is-visible");
    $("#sunsetEnding").setAttribute("aria-hidden", "false");
  });
  $("#closeEnding").addEventListener("click", () => {
    $("#sunsetEnding").classList.remove("is-visible");
    $("#sunsetEnding").setAttribute("aria-hidden", "true");
  });
  $("#restartJourney").addEventListener("click", () => {
    $("#sunsetEnding").classList.remove("is-visible");
    $("#sunsetEnding").setAttribute("aria-hidden", "true");
    activityHub.classList.remove("is-visible");
    appShell.classList.remove("is-visible");
    welcome.classList.remove("is-entering", "is-meeting");
    welcomeStoryStep = 0;
    welcomeEarnedStep = 0;
    renderWelcomeStory(0);
    startWelcomeStory();
  });

  renderWelcomeStory(0);
  titleFontReady.then((ready) => {
    if (ready) startWelcomeStory();
  });

  function createSeaNoise() {
    const seconds = 4;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * seconds, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      data[index] = previous * 2.4;
    }
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    gain.gain.value = 0.075;
    source.connect(filter).connect(gain).connect(musicMaster);
    source.start();
    seaNoise = source;
  }

  function scheduleNanyinNote() {
    if (!musicPlaying || !audioContext || !musicMaster) return;
    // 原创的闽台童谣意境乐句：五声音阶、洞箫长音、琵琶点弦与海潮。
    const moonlightMotif = [293.66, 329.63, 392, 440, 392, 329.63, 293.66, 261.63, 220, 261.63, 293.66, null, 329.63, 293.66, 261.63, 220];
    const frequency = moonlightMotif[musicStep % moonlightMotif.length];
    const now = audioContext.currentTime;

    if (frequency) {
      const flute = audioContext.createOscillator();
      const breath = audioContext.createOscillator();
      const vibrato = audioContext.createOscillator();
      const vibratoGain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      flute.type = "triangle";
      breath.type = "sine";
      vibrato.type = "sine";
      flute.frequency.value = frequency;
      breath.frequency.value = frequency * 2.002;
      vibrato.frequency.value = 4.1;
      vibratoGain.gain.value = 1.8;
      filter.type = "lowpass";
      filter.frequency.value = 1480;
      filter.Q.value = 1.6;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.048, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.018, now + 0.85);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.75);
      vibrato.connect(vibratoGain).connect(flute.frequency);
      flute.connect(filter);
      breath.connect(filter);
      filter.connect(gain).connect(musicMaster);
      flute.start(now);
      breath.start(now);
      vibrato.start(now);
      flute.stop(now + 2.8);
      breath.stop(now + 2.8);
      vibrato.stop(now + 2.8);

      const pluck = audioContext.createOscillator();
      const pluckFilter = audioContext.createBiquadFilter();
      const pluckGain = audioContext.createGain();
      pluck.type = musicStep % 2 ? "triangle" : "sine";
      pluck.frequency.setValueAtTime(frequency * 2, now);
      pluck.frequency.exponentialRampToValueAtTime(frequency * 1.45, now + 0.22);
      pluckFilter.type = "bandpass";
      pluckFilter.frequency.value = 1750;
      pluckFilter.Q.value = 2.4;
      pluckGain.gain.setValueAtTime(0.035, now);
      pluckGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      pluck.connect(pluckFilter).connect(pluckGain).connect(musicMaster);
      pluck.start(now);
      pluck.stop(now + 0.75);
    }

    if (musicStep % 4 === 0) {
      const drone = audioContext.createOscillator();
      const droneGain = audioContext.createGain();
      drone.type = "sine";
      drone.frequency.value = musicStep % 8 === 0 ? 110 : 146.83;
      droneGain.gain.setValueAtTime(0.0001, now);
      droneGain.gain.exponentialRampToValueAtTime(0.016, now + 0.3);
      droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
      drone.connect(droneGain).connect(musicMaster);
      drone.start(now);
      drone.stop(now + 3.7);
    }
    musicStep += 1;
  }

  function updateMusicControl() {
    const control = $("#musicToggle");
    control.classList.toggle("is-playing", musicPlaying);
    control.setAttribute("aria-pressed", String(musicPlaying));
    control.setAttribute("aria-label", musicPlaying ? "暂停龙美湾背景音乐" : "播放龙美湾背景音乐");
    $("#musicStatus").textContent = musicPlaying ? "背景音乐播放中" : "已静音 · 点击播放";
    $("#hubMusicToggle").classList.toggle("is-playing", musicPlaying);
    $("#hubMusicToggle").setAttribute("aria-pressed", String(musicPlaying));
  }

  async function startMusic({ silent = false } = {}) {
    if (!backgroundMusic || musicStartPending || musicPlaying) return;
    musicStartPending = true;
    backgroundMusic.volume = 0.46;
    backgroundMusic.muted = false;
    try {
      await backgroundMusic.play();
      musicPlaying = true;
      updateMusicControl();
    } catch {
      musicPlaying = false;
      updateMusicControl();
      $("#musicStatus").textContent = "首次触碰即播放";
      if (!silent) showToast("浏览器等待首次触碰，点击页面即可播放音乐");
    } finally {
      musicStartPending = false;
    }
  }

  function pauseMusic() {
    if (backgroundMusic) backgroundMusic.pause();
    musicPlaying = false;
    updateMusicControl();
  }

  $("#musicToggle").addEventListener("click", () => {
    if (musicPlaying) pauseMusic();
    else startMusic();
  });

  $("#hubMusicToggle").addEventListener("click", () => {
    if (musicPlaying) pauseMusic();
    else startMusic();
  });

  function unlockBackgroundMusic(event) {
    if (event.target?.closest?.("#musicToggle, #hubMusicToggle")) return;
    if (!musicPlaying) startMusic({ silent: true });
  }

  document.addEventListener("pointerdown", unlockBackgroundMusic, { once: true, passive: true });
  document.addEventListener("click", unlockBackgroundMusic, { once: true, capture: true });
  document.addEventListener("keydown", unlockBackgroundMusic, { once: true });
  const attemptMusicAutoplay = () => {
    if (document.visibilityState === "visible" && !musicPlaying) startMusic({ silent: true });
  };
  backgroundMusic.addEventListener("canplay", attemptMusicAutoplay, { once: true });
  window.addEventListener("pageshow", attemptMusicAutoplay);
  attemptMusicAutoplay();

  function goToStage(index) {
    const targetIndex = clamp(index, 0, sections.length - 1);
    scrollWorld.scrollTo({ left: targetIndex * scrollWorld.clientWidth, behavior: "smooth" });
    setActiveStage(targetIndex);
  }

  function setActiveStage(index) {
    currentStage = clamp(index, 0, sections.length - 1);
    navItems.forEach((item, itemIndex) => {
      const active = itemIndex === currentStage;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-current", active ? "step" : "false");
    });
    sections.forEach((section, sectionIndex) => section.classList.toggle("is-current-stage", sectionIndex === currentStage));
    prevStage.disabled = currentStage === 0;
    nextStage.disabled = currentStage === sections.length - 1;
    requestAnimationFrame(syncActiveRenderLoops);
  }

  navItems.forEach((item, index) => item.addEventListener("click", () => goToStage(index)));
  prevStage.addEventListener("click", () => goToStage(currentStage - 1));
  nextStage.addEventListener("click", () => goToStage(currentStage + 1));

  let scrollTicking = false;
  scrollWorld.addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      const index = Math.round(scrollWorld.scrollLeft / Math.max(1, scrollWorld.clientWidth));
      setActiveStage(index);
      scrollTicking = false;
    });
  });

  scrollWorld.addEventListener(
    "wheel",
    (event) => {
      if (window.innerWidth <= 760 || event.target.closest("input, textarea, .modal")) return;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        scrollWorld.scrollLeft += event.deltaY * 1.1;
      }
    },
    { passive: false },
  );

  // Letter writing
  const letterForm = $("#letterForm");
  const senderName = $("#senderName");
  const recipient = $("#recipient");
  const letterMessage = $("#letterMessage");
  const wordCount = $("#wordCount");
  const secretToggle = $("#secretToggle");
  const phrasePopover = $("#phrasePopover");

  function syncLetterMeta() {
    const sender = senderName.value.trim() || "寄信人";
    const receiver = recipient.value.trim() || "海那邊的你";
    $("#senderPreview").textContent = sender;
    $("#recipientPreview").textContent = receiver;
    $("#recipientRibbon").textContent = recipient.value.trim() ? `${receiver} 台啟` : "親啟";
  }

  senderName.addEventListener("input", syncLetterMeta);
  recipient.addEventListener("input", syncLetterMeta);
  syncLetterMeta();

  letterMessage.addEventListener("input", () => {
    wordCount.textContent = [...letterMessage.value].length;
  });

  function insertPhrase(phrase) {
    const start = letterMessage.selectionStart ?? letterMessage.value.length;
    const end = letterMessage.selectionEnd ?? letterMessage.value.length;
    const spacer = start > 0 && !/[\n\s]$/.test(letterMessage.value.slice(0, start)) ? "\n" : "";
    const nextValue = `${letterMessage.value.slice(0, start)}${spacer}${phrase}${letterMessage.value.slice(end)}`;
    letterMessage.value = [...nextValue].slice(0, 180).join("");
    letterMessage.dispatchEvent(new Event("input"));
    letterMessage.focus();
    const cursor = Math.min(start + spacer.length + phrase.length, letterMessage.value.length);
    letterMessage.setSelectionRange(cursor, cursor);
    phrasePopover.hidden = true;
    $("#morePhrases").setAttribute("aria-expanded", "false");
  }

  $$('[data-phrase]').forEach((button) => button.addEventListener("click", () => insertPhrase(button.dataset.phrase)));
  $("#morePhrases").addEventListener("click", (event) => {
    const isOpen = !phrasePopover.hidden;
    phrasePopover.hidden = isOpen;
    event.currentTarget.setAttribute("aria-expanded", String(!isOpen));
  });

  let scribeOriginal = "";

  function writeAsQiaopi(rawText) {
    let body = rawText
      .replace(/妈妈|妈咪|老妈/g, "母亲大人")
      .replace(/爸爸|老爸/g, "父亲大人")
      .replace(/想你了|很想你/g, "思念甚切")
      .replace(/别担心我/g, "毋须以我为念")
      .replace(/不用担心/g, "毋须挂念")
      .replace(/等我回去/g, "俟我归来")
      .replace(/早点回来/g, "盼早日归来")
      .replace(/身体健康/g, "身体康健")
      .replace(/[。！？!?]+$/g, "");
    if (!/[，。；：]/.test(body) && body.length > 16) body = `${body.slice(0, 16)}，${body.slice(16)}`;
    const receiver = recipient.value.trim();
    const salutation = receiver ? `${receiver}尊前：` : "敬启者：";
    const ending = /平安|珍重|挂念|团圆|归来/.test(body) ? "伏望珍重，盼雁字早回。" : "家中近况安稳，毋须挂念。顺颂安康。";
    return [...`${salutation}见字如晤。${body}。${ending}`].slice(0, 180).join("");
  }

  $("#qiaopiScribe").addEventListener("click", () => {
    const button = $("#qiaopiScribe");
    const status = $("#scribeStatus");
    if (button.dataset.mode === "restore") {
      letterMessage.value = scribeOriginal;
      letterMessage.dispatchEvent(new Event("input"));
      button.dataset.mode = "write";
      button.querySelector("b").textContent = "侨批先生代书";
      button.querySelector("small").textContent = "白话润成侨批书面语";
      status.className = "scribe-status is-ready";
      status.querySelector("b").textContent = "已还原你的原文";
      status.querySelector("small").textContent = "需要时，可以再次请先生润笔";
      return;
    }
    const rawText = letterMessage.value.trim();
    if (!rawText) {
      status.className = "scribe-status is-attention";
      status.querySelector("b").textContent = "先生还未收到白话原稿";
      status.querySelector("small").textContent = "先写下一两句想说的话，再点击代书";
      letterMessage.focus();
      return;
    }
    scribeOriginal = rawText;
    button.disabled = true;
    status.className = "scribe-status is-writing";
    status.querySelector("b").textContent = "侨批先生正在理句、落款……";
    status.querySelector("small").textContent = "保留原意，只调整称谓与书面语气";
    $("#letterPaper").classList.add("is-scribing");
    setTimeout(() => {
      letterMessage.value = writeAsQiaopi(rawText);
      letterMessage.dispatchEvent(new Event("input"));
      $("#letterPaper").classList.remove("is-scribing");
      status.className = "scribe-status is-complete";
      status.querySelector("b").textContent = "代书完成 · 原意已妥帖封存";
      status.querySelector("small").textContent = "点击“还原白话原文”可随时撤回";
      button.disabled = false;
      button.dataset.mode = "restore";
      button.querySelector("b").textContent = "还原白话原文";
      button.querySelector("small").textContent = "保留一份属于你的原声";
    }, 820);
  });

  secretToggle.addEventListener("change", () => {
    $("#privacyTitle").textContent = secretToggle.checked ? "密信封存" : "公开岩信";
    $("#privacyHint").textContent = secretToggle.checked ? "仅在本机保存，不进入公开岩壁" : "抵岸后留在公共岩壁";
  });

  function fieldError(field, message) {
    field.focus();
    field.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 260 },
    );
    showToast(message);
  }

  letterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!senderName.value.trim()) return fieldError(senderName, "请先留下寄信人的名字");
    if (!recipient.value.trim()) return fieldError(recipient, "请告诉这封信要寄往哪里");
    if (letterMessage.value.trim().length < 4) return fieldError(letterMessage, "再多写几句话，让海风认得你的思念");

    currentLetter = {
      id: `rock-${Date.now()}`,
      sender: senderName.value.trim(),
      recipient: recipient.value.trim(),
      message: letterMessage.value.trim(),
      secret: secretToggle.checked,
      date: new Date().toISOString(),
    };
    openPoster();
  });

  // Poster generation
  const posterModal = $("#posterModal");
  const posterCanvas = $("#posterCanvas");
  const posterLoading = $("#posterLoading");
  const posterActionFeedback = $("#posterActionFeedback");
  const posterFeedbackTitle = $("#posterFeedbackTitle");
  const posterFeedbackDetail = $("#posterFeedbackDetail");
  const savePosterButton = $("#savePoster");
  const sharePosterButton = $("#sharePoster");
  const releaseBoatButton = $("#releaseBoat");
  const posterImage = new Image();
  let posterImageLoaded = false;
  let posterBlob = null;
  posterImage.onload = () => {
    posterImageLoaded = true;
    if (currentLetter && posterModal.classList.contains("is-open")) drawPoster();
  };
  posterImage.src = "assets/longmei-bay-hero.webp";

  function seedFromText(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return Math.abs(value >>> 0);
  }

  function seededRandom(seed) {
    let state = seed || 1;
    return () => {
      state = Math.imul(1664525, state) + 1013904223;
      return ((state >>> 0) % 10000) / 10000;
    };
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const characters = [...text];
    const lines = [];
    let line = "";
    characters.forEach((character) => {
      const test = line + character;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].slice(0, -1)}…`;
    visible.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
    return visible.length;
  }

  function drawVerticalText(ctx, text, startX, startY, columnHeight, characterGap, columnGap, maxColumns) {
    const characters = [...text];
    let column = 0;
    let row = 0;
    const rowsPerColumn = Math.max(1, Math.floor(columnHeight / characterGap));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index];
      if (character === "\n") {
        column += 1;
        row = 0;
        continue;
      }
      if (row >= rowsPerColumn) {
        column += 1;
        row = 0;
      }
      if (column >= maxColumns) {
        ctx.fillText("…", startX - (maxColumns - 1) * columnGap, startY + (rowsPerColumn - 1) * characterGap);
        break;
      }
      ctx.fillText(character, startX - column * columnGap, startY + row * characterGap);
      row += 1;
    }
    ctx.restore();
  }

  function drawContourLines(ctx, random) {
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "#efe1c2";
    ctx.lineWidth = 2;
    for (let index = 0; index < 18; index += 1) {
      const baseY = 140 + index * 68 + random() * 25;
      ctx.beginPath();
      ctx.moveTo(-30, baseY);
      for (let x = -30; x <= 1110; x += 45) {
        const wave = Math.sin(x / (85 + random() * 40) + index * 0.74) * (22 + random() * 38);
        ctx.lineTo(x, baseY + wave);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPseudoQr(ctx, seed, x, y, size) {
    const random = seededRandom(seed);
    const cells = 13;
    const cell = size / cells;
    ctx.save();
    ctx.fillStyle = "rgba(242, 234, 215, 0.9)";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#173f41";
    for (let row = 0; row < cells; row += 1) {
      for (let column = 0; column < cells; column += 1) {
        if (random() > 0.52) ctx.fillRect(x + column * cell, y + row * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    [[0, 0], [cells - 4, 0], [0, cells - 4]].forEach(([column, row]) => {
      ctx.fillStyle = "#173f41";
      ctx.fillRect(x + column * cell, y + row * cell, cell * 4, cell * 4);
      ctx.fillStyle = "#f2ead7";
      ctx.fillRect(x + (column + 1) * cell, y + (row + 1) * cell, cell * 2, cell * 2);
      ctx.fillStyle = "#173f41";
      ctx.fillRect(x + (column + 1.5) * cell, y + (row + 1.5) * cell, cell, cell);
    });
    ctx.restore();
  }

  function drawPoster() {
    if (!posterImageLoaded || !currentLetter) return;
    posterReady = false;
    posterBlob = null;
    posterLoading.classList.remove("is-hidden");
    const ctx = posterCanvas.getContext("2d");
    const width = posterCanvas.width;
    const height = posterCanvas.height;
    const seed = seedFromText(currentLetter.sender + currentLetter.message);
    const random = seededRandom(seed);

    ctx.clearRect(0, 0, width, height);
    const imageRatio = posterImage.width / posterImage.height;
    const targetRatio = width / height;
    let sourceWidth = posterImage.width;
    let sourceHeight = posterImage.height;
    let sourceX = 0;
    let sourceY = 0;
    if (imageRatio > targetRatio) {
      sourceWidth = posterImage.height * targetRatio;
      sourceX = (posterImage.width - sourceWidth) * 0.58;
    } else {
      sourceHeight = posterImage.width / targetRatio;
      sourceY = (posterImage.height - sourceHeight) * 0.5;
    }
    ctx.drawImage(posterImage, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

    const wash = ctx.createLinearGradient(0, 0, 0, height);
    wash.addColorStop(0, "rgba(11, 49, 53, .06)");
    wash.addColorStop(0.37, "rgba(11, 45, 48, .34)");
    wash.addColorStop(1, "rgba(8, 34, 36, .96)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    drawContourLines(ctx, random);

    ctx.save();
    ctx.strokeStyle = "rgba(244, 222, 180, .55)";
    ctx.setLineDash([9, 13]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 312);
    ctx.bezierCurveTo(360, 225, 675, 360, 965, 236);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#b55039";
    ctx.beginPath();
    ctx.moveTo(650, 257);
    ctx.lineTo(676, 271);
    ctx.lineTo(650, 279);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(235, 215, 176, .95)";
    roundRect(ctx, 76, 342, 928, 768, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(126, 75, 44, .34)";
    ctx.lineWidth = 2;
    ctx.strokeRect(94, 360, 892, 732);

    // Traditional Quanzhou qiaopi fold lines, read from right to left.
    ctx.save();
    for (let foldX = 130; foldX <= 960; foldX += 54) {
      ctx.strokeStyle = foldX % 108 === 22 ? "rgba(255, 251, 232, .34)" : "rgba(158, 65, 42, .22)";
      ctx.lineWidth = foldX % 108 === 22 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(foldX, 450);
      ctx.lineTo(foldX, 1038);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "#a94934";
    ctx.font = '600 31px "Songti SC", SimSun, serif';
    ctx.fillText("龍美岩信局", 174, 411);
    ctx.fillStyle = "#765b3f";
    ctx.font = '18px "Songti SC", SimSun, serif';
    ctx.fillText("泉州銀信式 · 龍美灣雲寄分局", 385, 408);
    ctx.fillStyle = "rgba(100, 72, 45, .72)";
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText("LONGMEI ROCK LETTER · QIAOPI ACROSS THE STRAIT", 385, 432);

    ctx.strokeStyle = "rgba(168, 70, 48, .72)";
    ctx.lineWidth = 3;
    ctx.strokeRect(112, 376, 48, 48);
    ctx.font = '23px "Songti SC", SimSun, serif';
    ctx.fillStyle = "rgba(168, 70, 48, .8)";
    ctx.textAlign = "center";
    ctx.fillText("桐", 136, 409);
    ctx.textAlign = "left";

    // Cinnabar address strip, adapted from local silver-letter envelopes.
    const ribbonGradient = ctx.createLinearGradient(826, 0, 903, 0);
    ribbonGradient.addColorStop(0, "rgba(143, 48, 34, .9)");
    ribbonGradient.addColorStop(0.5, "rgba(183, 61, 41, .92)");
    ribbonGradient.addColorStop(1, "rgba(139, 45, 33, .9)");
    ctx.fillStyle = ribbonGradient;
    ctx.fillRect(829, 470, 74, 506);
    ctx.strokeStyle = "rgba(83, 33, 25, .42)";
    ctx.strokeRect(837, 480, 58, 486);
    ctx.fillStyle = "#2c2924";
    ctx.font = '34px "STKaiti", KaiTi, cursive';
    drawVerticalText(ctx, currentLetter.recipient, 866, 514, 330, 39, 0, 1);
    ctx.font = '22px "Songti SC", SimSun, serif';
    drawVerticalText(ctx, "尊前台啟", 866, 860, 100, 28, 0, 1);

    ctx.fillStyle = "#2c302a";
    ctx.font = '31px "STKaiti", KaiTi, cursive';
    drawVerticalText(ctx, currentLetter.message, 773, 492, 482, 35, 52, 13);

    ctx.fillStyle = "#493a2d";
    ctx.font = '23px "STKaiti", KaiTi, cursive';
    drawVerticalText(ctx, `歲在丙午${currentLetter.sender}謹上`, 128, 500, 460, 28, 0, 1);

    ctx.fillStyle = "rgba(103, 70, 43, .74)";
    ctx.font = '15px "Songti SC", SimSun, serif';
    drawVerticalText(ctx, "泉州府寄龍美岩信局代封", 948, 500, 460, 22, 0, 1);

    ctx.fillStyle = "#8a7359";
    ctx.font = '18px "Songti SC", SimSun, serif';
    ctx.fillText(currentLetter.secret ? "密信封存 · 此刻只为你留存" : "公開岩信 · 將在彼岸凝成石紋", 128, 1068);

    ctx.fillStyle = "#f3e8cf";
    ctx.font = '500 48px "Songti SC", SimSun, serif';
    ctx.fillText("一封家书，穿海而来", 76, 1195);
    ctx.fillStyle = "rgba(243, 232, 207, .65)";
    ctx.font = '19px Arial, sans-serif';
    ctx.fillText("LONGMEI ROCK LETTER · DIGITAL QIAOPI 2026", 78, 1235);
    ctx.font = '18px "Songti SC", SimSun, serif';
    ctx.fillText("字迹编号", 78, 1312);
    ctx.fillStyle = "#d4b47d";
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(String(seed).slice(0, 8).padStart(8, "0"), 172, 1312);
    drawPseudoQr(ctx, seed, 874, 1244, 108);

    posterCanvas.toBlob((blob) => {
      posterBlob = blob;
      posterReady = true;
      posterLoading.classList.add("is-hidden");
    }, "image/png");
  }

  function setPosterFeedback(state, title, detail, mark = "✓") {
    posterActionFeedback.dataset.state = state;
    posterActionFeedback.querySelector("i").textContent = mark;
    posterFeedbackTitle.textContent = title;
    posterFeedbackDetail.textContent = detail;
    releaseBoatButton.classList.toggle("is-ready", state === "success");
  }

  function resetPosterActions() {
    savePosterButton.classList.remove("is-working", "is-success");
    sharePosterButton.classList.remove("is-working", "is-success");
    savePosterButton.innerHTML = "保存岩信海报 <i>↓</i>";
    sharePosterButton.innerHTML = "分享给想念的人 <i>↗</i>";
    releaseBoatButton.disabled = false;
    setPosterFeedback("ready", "海报已生成，可以保存或分享", "完成后，继续让信笺化为纸舟", "01");
  }

  function openPoster() {
    posterModal.classList.add("is-open");
    posterModal.setAttribute("aria-hidden", "false");
    posterLoading.classList.remove("is-hidden");
    resetPosterActions();
    if (posterImageLoaded) requestAnimationFrame(drawPoster);
  }

  function closePoster() {
    posterModal.classList.remove("is-open");
    posterModal.setAttribute("aria-hidden", "true");
  }

  $$('[data-close-modal]').forEach((item) => item.addEventListener("click", closePoster));

  function getPosterBlob() {
    if (posterBlob) return Promise.resolve(posterBlob);
    return new Promise((resolve) => posterCanvas.toBlob((blob) => {
      posterBlob = blob;
      resolve(blob);
    }, "image/png"));
  }

  function downloadPoster(blob) {
    if (!blob || !currentLetter) return false;
    const link = document.createElement("a");
    link.download = `龙美岩信-${currentLetter.sender}.png`.replace(/[\\/:*?"<>|]/g, "-");
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    return true;
  }

  savePosterButton.addEventListener("click", async () => {
    if (!posterReady || !currentLetter) {
      setPosterFeedback("working", "岩纹海报仍在生成", "请稍候，完成后即可保存", "…");
      return showToast("海报还在生成，请稍候");
    }
    savePosterButton.classList.add("is-working");
    savePosterButton.innerHTML = "正在保存海报 <i>…</i>";
    setPosterFeedback("working", "正在生成高清图片", "即将保存到浏览器下载目录", "…");
    const blob = await getPosterBlob();
    if (!blob) {
      savePosterButton.classList.remove("is-working");
      savePosterButton.innerHTML = "重新保存海报 <i>↓</i>";
      setPosterFeedback("error", "当前浏览器限制自动保存", "可以长按左侧海报截图留存", "!");
      return showToast("当前浏览器限制保存，可长按海报截图留存");
    }
    downloadPoster(blob);
    savePosterButton.classList.remove("is-working");
    savePosterButton.classList.add("is-success");
    savePosterButton.innerHTML = "海报已保存 <i>✓</i>";
    setPosterFeedback("success", "保存完成，岩信已经留存", "点击下方“下一步”让信笺化舟", "✓");
    showToast("岩信海报已保存到设备");
  });

  function copyShareText(text) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    helper.remove();
    return copied;
  }

  sharePosterButton.addEventListener("click", async () => {
    if (!posterReady || !currentLetter) {
      setPosterFeedback("working", "岩纹海报仍在生成", "请稍候，完成后即可分享", "…");
      return showToast("海报还在生成，请稍候");
    }
    sharePosterButton.classList.add("is-working");
    sharePosterButton.innerHTML = "正在准备分享 <i>…</i>";
    setPosterFeedback("working", "正在准备分享内容", "支持系统分享；不支持时自动复制文案", "…");
    const blob = await getPosterBlob();
    const shareText = `${currentLetter.sender} 在龙美湾寄出了一封穿海而行的岩信。见字如面，山海相连。`;
    try {
      const file = blob && typeof File !== "undefined"
        ? new File([blob], `龙美岩信-${currentLetter.sender}.png`, { type: "image/png" })
        : null;
      const canShareFile = Boolean(navigator.share && file && (!navigator.canShare || navigator.canShare({ files: [file] })));
      if (canShareFile) {
        await navigator.share({ title: "龙美岩信", text: shareText, files: [file] });
        sharePosterButton.classList.remove("is-working");
        sharePosterButton.classList.add("is-success");
        sharePosterButton.innerHTML = "系统分享已完成 <i>✓</i>";
        setPosterFeedback("success", "分享完成，岩信继续远行", "图片与寄语已交给系统分享面板", "✓");
        showToast("岩信图片已交给系统分享");
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "龙美岩信", text: shareText });
        sharePosterButton.classList.remove("is-working");
        sharePosterButton.classList.add("is-success");
        sharePosterButton.innerHTML = "系统分享已打开 <i>✓</i>";
        setPosterFeedback("success", "分享面板已打开", "如需分享图片，可同时保存岩信海报", "✓");
        return;
      }

      let copied = false;
      try {
        await navigator.clipboard.writeText(shareText);
        copied = true;
      } catch {
        copied = copyShareText(shareText);
      }
      sharePosterButton.classList.remove("is-working");
      if (copied) {
        sharePosterButton.classList.add("is-success");
        sharePosterButton.innerHTML = "分享文案已复制 <i>✓</i>";
        setPosterFeedback("success", "文案已复制，可以粘贴分享", "保存海报后，可与文案一起发送到朋友圈", "✓");
        showToast("分享文案已复制，可粘贴到朋友圈");
      } else {
        sharePosterButton.innerHTML = "重新尝试分享 <i>↗</i>";
        setPosterFeedback("error", "当前浏览器未开放分享权限", "请先保存海报，再发送给想念的人", "!");
        showToast("请先保存海报，再发送给想念的人");
      }
    } catch (error) {
      sharePosterButton.classList.remove("is-working");
      sharePosterButton.innerHTML = "分享给想念的人 <i>↗</i>";
      if (error.name === "AbortError") {
        setPosterFeedback("ready", "已取消系统分享", "你仍可保存海报，或继续让信笺化舟", "01");
        showToast("已取消分享");
      } else {
        setPosterFeedback("error", "分享没有完成", "可先保存海报，再发送给想念的人", "!");
        showToast("可先保存海报，再分享给想念的人");
      }
    }
  });

  function releaseAsBoat() {
    releaseBoatButton.disabled = true;
    setPosterFeedback("working", "信笺正在折成纸舟", "即将跳转至“驭舟过海”", "→");
    showToast("信笺化舟，正在进入台湾海峡航程");
    closePoster();
    const flyingLetter = document.createElement("div");
    flyingLetter.className = "flying-letter";
    flyingLetter.innerHTML = "<span>龍美岩信</span>";
    document.body.appendChild(flyingLetter);
    flyingLetter.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg) scale(1)", clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", opacity: 1 },
        { transform: "translate(-50%, -50%) rotate(12deg) scale(.72)", clipPath: "polygon(50% 0, 100% 45%, 73% 100%, 27% 100%, 0 45%)", opacity: 1, offset: 0.55 },
        { transform: "translate(38vw, 24vh) rotate(22deg) scale(.28)", clipPath: "polygon(50% 0, 100% 45%, 73% 100%, 27% 100%, 0 45%)", opacity: 0 },
      ],
      { duration: 1050, easing: "cubic-bezier(.3,.75,.3,1)", fill: "forwards" },
    ).onfinish = () => flyingLetter.remove();
    setTimeout(() => {
      goToStage(1);
      setTimeout(startVoyage, 650);
    }, 620);
  }

  $("#releaseBoat").addEventListener("click", releaseAsBoat);

  // Sea crossing canvas
  const seaCanvas = $("#seaCanvas");
  const seaContext = seaCanvas.getContext("2d");
  const seaInput = { up: false, down: false, boost: false };
  const seaState = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    running: false,
    complete: false,
    progress: 0,
    boatY: 0,
    targetY: 0,
    obstacles: [],
    particles: [],
    spawnTimer: 0,
    lastTime: performance.now(),
    lastCollision: 0,
    score: 0,
    combo: 1,
    life: 3,
    energy: 100,
    memory: 0,
    memoryCollected: 0,
    shield: 0,
    nearMisses: 0,
    failed: false,
    boosting: false,
    boatVelocity: 0,
    boatFlash: 0,
  };

  function resizeSea() {
    const rect = seaCanvas.getBoundingClientRect();
    seaState.dpr = performanceLite ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    seaState.width = Math.max(1, rect.width);
    seaState.height = Math.max(1, rect.height);
    seaCanvas.width = Math.round(seaState.width * seaState.dpr);
    seaCanvas.height = Math.round(seaState.height * seaState.dpr);
    seaContext.setTransform(seaState.dpr, 0, 0, seaState.dpr, 0, 0);
    if (!seaState.boatY) seaState.boatY = seaState.height * 0.55;
    seaState.targetY = clamp(seaState.targetY || seaState.boatY, 75, seaState.height - 70);
  }

  function drawSeaBackground(ctx, width, height, time, progress) {
    const seaVeil = ctx.createLinearGradient(0, 0, 0, height);
    seaVeil.addColorStop(0, "rgba(25, 78, 80, .08)");
    seaVeil.addColorStop(0.34, "rgba(20, 78, 80, .16)");
    seaVeil.addColorStop(1, "rgba(4, 48, 55, .34)");
    ctx.fillStyle = seaVeil;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(232, 218, 184, .12)";
    ctx.beginPath();
    ctx.ellipse(width * 0.18, height * 0.18, width * 0.18, height * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(18, 54, 53, .23)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.29);
    ctx.lineTo(width * 0.06, height * 0.19);
    ctx.lineTo(width * 0.13, height * 0.27);
    ctx.lineTo(width * 0.2, height * 0.2);
    ctx.lineTo(width * 0.27, height * 0.34);
    ctx.lineTo(0, height * 0.4);
    ctx.closePath();
    ctx.fill();

    const farCoastAlpha = 0.12 + (progress / 100) * 0.2;
    ctx.fillStyle = `rgba(45, 61, 54, ${farCoastAlpha})`;
    ctx.beginPath();
    ctx.moveTo(width * 0.75, height * 0.34);
    ctx.lineTo(width * 0.82, height * 0.2);
    ctx.lineTo(width * 0.87, height * 0.25);
    ctx.lineTo(width * 0.93, height * 0.12);
    ctx.lineTo(width, height * 0.18);
    ctx.lineTo(width, height * 0.41);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(239, 222, 190, .52)";
    ctx.font = "9px Arial";
    ctx.letterSpacing = "1px";
    ctx.fillText("福建 · 龙美湾 · 游子启程", width * 0.04, height * 0.18);
    ctx.textAlign = "right";
    ctx.fillText("台湾海峡彼岸 · 乡音相望", width * 0.96, height * 0.1);
    ctx.textAlign = "left";

    ctx.lineWidth = 1;
    const waveCount = performanceLite ? 10 : 15;
    for (let index = 0; index < waveCount; index += 1) {
      const y = height * 0.31 + index * ((height * 0.64) / waveCount);
      ctx.strokeStyle = `rgba(220, 237, 224, ${0.08 + (index % 3) * 0.025})`;
      ctx.beginPath();
      for (let x = -20; x <= width + 20; x += 18) {
        const offset = Math.sin(x * 0.026 + time * (0.6 + index * 0.01) + index) * (2.2 + index * 0.11);
        if (x === -20) ctx.moveTo(x, y + offset);
        else ctx.lineTo(x, y + offset);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.setLineDash([5, 10]);
    ctx.strokeStyle = "rgba(242, 219, 174, .28)";
    ctx.beginPath();
    ctx.moveTo(width * 0.12, height * 0.62);
    ctx.bezierCurveTo(width * 0.36, height * 0.48, width * 0.7, height * 0.74, width * 0.94, height * 0.55);
    ctx.stroke();
    ctx.restore();

    const distantBoatCount = performanceLite ? 4 : 6;
    for (let index = 0; index < distantBoatCount; index += 1) {
      const x = ((index * width * 0.19 - time * (8 + index) - progress * 1.2) % (width * 1.25)) + width * 0.1;
      const y = height * (0.37 + (index % 4) * 0.13);
      drawPaperBoat(ctx, x, y, 0.28 + (index % 3) * 0.07, "rgba(238, 226, 199, .45)", time + index);
    }
  }

  function drawPaperBoat(ctx, x, y, scale = 1, color = "#f5ead1", time = 0) {
    const distant = scale < 0.5;
    ctx.save();
    ctx.translate(x, y + Math.sin(time * 2.2) * 3);
    ctx.scale(scale, scale);

    // 水面倒影与信舟尾迹
    ctx.globalAlpha = distant ? 0.42 : 0.68;
    ctx.strokeStyle = "rgba(242, 205, 133, .52)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-4, 21, 44, 5.5, -0.05, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-29, 17);
    ctx.quadraticCurveTo(-47, 23, -64, 18);
    ctx.stroke();
    ctx.globalAlpha = distant ? 0.55 : 1;

    // 外轮廓：与抵岸画面中的金边岩信舟保持一致
    ctx.shadowColor = "rgba(239, 190, 100, .72)";
    ctx.shadowBlur = distant ? 7 : 18;
    const paperGlow = ctx.createLinearGradient(-38, -27, 38, 20);
    paperGlow.addColorStop(0, color);
    paperGlow.addColorStop(0.46, "#fff1cf");
    paperGlow.addColorStop(0.72, "#edca8c");
    paperGlow.addColorStop(1, "#c99145");
    ctx.fillStyle = paperGlow;
    ctx.strokeStyle = "rgba(102, 69, 38, .78)";
    ctx.lineWidth = distant ? 1 : 1.25;
    ctx.beginPath();
    ctx.moveTo(-39, -2);
    ctx.lineTo(0, -28);
    ctx.lineTo(40, -2);
    ctx.lineTo(22, 19);
    ctx.lineTo(-22, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 四片折纸面使用不同明度，形成真实折痕
    ctx.shadowBlur = 0;
    ctx.fillStyle = distant ? "rgba(255, 244, 214, .3)" : "rgba(255, 249, 228, .66)";
    ctx.beginPath();
    ctx.moveTo(-39, -2);
    ctx.lineTo(0, -28);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = distant ? "rgba(224, 174, 96, .25)" : "rgba(216, 159, 74, .4)";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(40, -2);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = distant ? "rgba(238, 210, 158, .28)" : "rgba(229, 194, 132, .62)";
    ctx.beginPath();
    ctx.moveTo(-39, -2);
    ctx.lineTo(0, 4);
    ctx.lineTo(40, -2);
    ctx.lineTo(22, 19);
    ctx.lineTo(-22, 19);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(105, 70, 37, .55)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-39, -2);
    ctx.lineTo(0, 4);
    ctx.lineTo(40, -2);
    ctx.moveTo(0, -28);
    ctx.lineTo(0, 4);
    ctx.moveTo(-22, 19);
    ctx.lineTo(0, 4);
    ctx.lineTo(22, 19);
    ctx.stroke();

    if (!distant) {
      ctx.fillStyle = "#ad4935";
      ctx.beginPath();
      ctx.arc(0, 4, 4.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 225, 180, .58)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 247, 226, .9)";
      ctx.font = "5px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("信", 0, 4.3);
    }
    ctx.restore();
  }

  function spawnObstacle() {
    const margin = 90;
    const roll = Math.random();
    const type = roll < 0.46 ? "rock" : roll < 0.72 ? "wave" : "wind";
    let spawnY = margin + Math.random() * Math.max(80, seaState.height - margin * 2);
    if (type !== "wind" && Math.abs(spawnY - seaState.boatY) < 78) {
      spawnY += spawnY < seaState.boatY ? -105 : 105;
      spawnY = clamp(spawnY, margin, seaState.height - margin);
    }
    seaState.obstacles.push({
      x: seaState.width + 70,
      y: spawnY,
      radius: type === "rock" ? 24 + Math.random() * 18 : type === "wave" ? 30 + Math.random() * 12 : 17,
      type,
      hit: false,
      passed: false,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function drawObstacle(ctx, obstacle, time) {
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    if (obstacle.type === "rock") {
      ctx.fillStyle = obstacle.hit ? "rgba(116, 86, 67, .42)" : "#6e736c";
      ctx.strokeStyle = "rgba(224, 218, 194, .35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-obstacle.radius, obstacle.radius * 0.62);
      ctx.lineTo(-obstacle.radius * 0.54, -obstacle.radius * 0.3);
      ctx.lineTo(-obstacle.radius * 0.12, -obstacle.radius);
      ctx.lineTo(obstacle.radius * 0.64, -obstacle.radius * 0.48);
      ctx.lineTo(obstacle.radius, obstacle.radius * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(236, 228, 203, .18)";
      ctx.beginPath();
      ctx.arc(0, 6, obstacle.radius * 0.58, Math.PI * 1.1, Math.PI * 1.82);
      ctx.stroke();
    } else if (obstacle.type === "wave") {
      ctx.strokeStyle = obstacle.hit ? "rgba(207, 233, 224, .25)" : "rgba(220, 240, 230, .72)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 8, obstacle.radius, Math.PI * 1.06, Math.PI * 1.9);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(7, 4 + Math.sin(time * 3 + obstacle.phase) * 3, obstacle.radius * 0.65, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.rotate(time * 0.9 + obstacle.phase);
      ctx.shadowColor = "rgba(239, 199, 121, .65)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = obstacle.hit ? "rgba(222, 183, 111, .2)" : "#e6be79";
      ctx.strokeStyle = "rgba(255, 239, 203, .8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let point = 0; point < 8; point += 1) {
        const angle = (point / 8) * Math.PI * 2;
        const radius = point % 2 ? obstacle.radius * 0.45 : obstacle.radius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.rotate(-(time * 0.9 + obstacle.phase));
      ctx.fillStyle = "#8f4938";
      ctx.font = "11px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("风", 0, 1);
    }
    ctx.restore();
  }

  function createCollisionParticles(x, y, color = "229, 239, 225") {
    const particleCount = performanceLite ? 8 : 12;
    for (let index = 0; index < particleCount; index += 1) {
      seaState.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.7) * 100,
        life: 0.8 + Math.random() * 0.4,
        color,
      });
    }
  }

  function updateSeaHud() {
    $("#seaScore").textContent = Math.max(0, Math.floor(seaState.score)).toLocaleString();
    $("#seaCombo").textContent = `×${seaState.combo}`;
    $("#seaLife").textContent = `${"◆".repeat(seaState.life)}${"◇".repeat(3 - seaState.life)}`;
    const memoryGoal = `${Math.min(2, seaState.memoryCollected)}/2`;
    const memoryText = seaState.shield ? `${memoryGoal} · 灯已亮` : `${memoryGoal} · ${"●".repeat(seaState.memory)}${"○".repeat(3 - seaState.memory)}`;
    $("#seaMemory").textContent = memoryText;
    $("#seaMemory").closest("span").classList.toggle("is-lit", Boolean(seaState.shield));
    $("#seaEnergyBar").style.width = `${seaState.energy}%`;
    $("#seaEnergyText").textContent = `${Math.round(seaState.energy)}%`;
  }

  function showSeaGameMessage(message) {
    const element = $("#seaGameMessage");
    element.textContent = message;
    element.classList.remove("is-showing");
    void element.offsetWidth;
    element.classList.add("is-showing");
  }

  function pauseVoyageAfterDamage(title = "这一程，岩信还未抵岸", hint = "礁石击破了三层船体，但家书不会沉没。换一阵风，再从龙美湾启程。") {
    seaState.running = false;
    seaState.failed = true;
    seaState.boosting = false;
    seaInput.boost = false;
    $("#seaBoost").classList.remove("is-active");
    $("#seaBoost").disabled = true;
    $("#seaStatus").textContent = "未能抵岸 · 等待重渡";
    $("#startVoyage").textContent = "未能抵岸 · 请查看回信";
    $("#startVoyage").disabled = true;
    $("#seaInstruction").classList.add("is-hidden");
    $("#seaResultProgress").textContent = `${Math.floor(seaState.progress)}%`;
    $("#seaResultScore").textContent = Math.floor(seaState.score).toLocaleString();
    $("#seaResultTitle").textContent = title;
    $("#seaResultHint").textContent = hint;
    $("#seaResult").hidden = false;
    showToast("岩信尚未抵岸，家书正在等待下一阵风");
    setTimeout(() => $("#restartVoyage").focus({ preventScroll: true }), 120);
  }

  function updateSea(delta, now) {
    seaState.time += delta;
    const verticalIntent = (seaInput.down ? 1 : 0) - (seaInput.up ? 1 : 0);
    if (verticalIntent) {
      seaState.boatVelocity += verticalIntent * 520 * delta;
      seaState.targetY = seaState.boatY;
    } else {
      seaState.boatY += (seaState.targetY - seaState.boatY) * Math.min(1, delta * 5.5);
    }
    seaState.boatVelocity *= Math.pow(0.045, delta);
    seaState.boatY = clamp(seaState.boatY + seaState.boatVelocity * delta, 72, seaState.height - 68);
    if (!seaState.running) return;

    seaState.boosting = seaInput.boost && seaState.energy > 1;
    if (seaState.boosting) seaState.energy = Math.max(0, seaState.energy - delta * 29);
    else seaState.energy = Math.min(100, seaState.energy + delta * 14);

    const progressSpeed = seaState.boosting ? 7.6 : 4.35;
    const worldSpeed = seaState.boosting ? 185 : 112;
    seaState.progress = Math.min(100, seaState.progress + delta * progressSpeed);
    seaState.score += delta * (seaState.boosting ? 38 : 18) * seaState.combo;
    seaState.spawnTimer -= delta;
    if (seaState.spawnTimer <= 0 && seaState.progress < 94) {
      spawnObstacle();
      seaState.spawnTimer = 1.02 + Math.random() * 0.64;
    }

    const boatX = seaState.width * 0.25;
    seaState.obstacles.forEach((obstacle) => {
      obstacle.x -= delta * worldSpeed * (obstacle.type === "wave" ? 0.78 : 1);
      obstacle.y += Math.sin(seaState.time * 2.2 + obstacle.phase) * 0.13;
      const boatRadius = 22 + (seaState.boosting ? 5 : 0);
      const distance = Math.hypot(obstacle.x - boatX, obstacle.y - seaState.boatY);
      if (obstacle.hit || distance >= obstacle.radius * (obstacle.type === "wind" ? 0.82 : 0.7) + boatRadius) return;

      if (obstacle.type === "wind") {
        obstacle.hit = true;
        seaState.combo = Math.min(6, seaState.combo + 1);
        seaState.energy = Math.min(100, seaState.energy + 23);
        seaState.memory += 1;
        seaState.memoryCollected += 1;
        const reward = 120 * seaState.combo;
        seaState.score += reward;
        createCollisionParticles(boatX + 18, seaState.boatY, "239, 202, 132");
        if (seaState.memory >= 3) {
          seaState.memory = 0;
          seaState.shield = 1;
          showSeaGameMessage(`乡音成灯 · 可抵一次礁石`);
        } else {
          showSeaGameMessage(`收下乡音 ${seaState.memory}/3 · +${reward}`);
        }
        return;
      }

      if (now - seaState.lastCollision <= 1250) return;
      obstacle.hit = true;
      seaState.lastCollision = now;
      seaState.combo = 1;
      seaState.boatFlash = 0.85;
      createCollisionParticles(boatX + 18, seaState.boatY);
      if (obstacle.type === "rock") {
        if (seaState.shield) {
          seaState.shield = 0;
          seaState.score += 80;
          createCollisionParticles(boatX + 18, seaState.boatY, "244, 205, 126");
          showSeaGameMessage("乡音护舟 · 挡住礁石");
        } else {
          seaState.life -= 1;
          seaState.progress = Math.max(0, seaState.progress - 5.5);
          seaState.score = Math.max(0, seaState.score - 150);
          showSeaGameMessage("触礁 · 船体缩小 · 航程回退");
          if (seaState.life <= 0) pauseVoyageAfterDamage();
        }
      } else {
        seaState.energy = Math.max(0, seaState.energy - 26);
        seaState.score = Math.max(0, seaState.score - 65);
        seaState.boatVelocity += Math.random() > 0.5 ? 125 : -125;
        showSeaGameMessage("暗流偏航 · 顺风下降");
      }
    });
    seaState.obstacles.forEach((obstacle) => {
      if (obstacle.hit || obstacle.passed || obstacle.type === "wind" || obstacle.x >= boatX - 16) return;
      obstacle.passed = true;
      const safeGap = Math.abs(obstacle.y - seaState.boatY) - obstacle.radius;
      if (safeGap > 19 && safeGap < 64) {
        seaState.nearMisses += 1;
        seaState.combo = Math.min(6, seaState.combo + 1);
        const nearReward = 85 * seaState.combo;
        seaState.score += nearReward;
        showSeaGameMessage(`贴浪穿行 · +${nearReward}`);
      }
    });
    seaState.obstacles = seaState.obstacles.filter((obstacle) => obstacle.x > -90 && !obstacle.hit);
    seaState.particles.forEach((particle) => {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 90 * delta;
      particle.life -= delta;
    });
    seaState.particles = seaState.particles.filter((particle) => particle.life > 0);
    seaState.boatFlash = Math.max(0, seaState.boatFlash - delta);

    const roundedProgress = Math.floor(seaState.progress);
    $("#voyageBar").style.width = `${roundedProgress}%`;
    $("#voyageBoat").style.left = `calc(${roundedProgress}% - 7px)`;
    $("#voyagePercent").textContent = `${roundedProgress}%`;
    updateSeaHud();

    if (seaState.progress >= 100) completeVoyage();
  }

  function renderSea() {
    const ctx = seaContext;
    const { width, height } = seaState;
    ctx.clearRect(0, 0, width, height);
    drawSeaBackground(ctx, width, height, seaState.time, seaState.progress);
    seaState.obstacles.forEach((obstacle) => drawObstacle(ctx, obstacle, seaState.time));

    seaState.particles.forEach((particle) => {
      ctx.fillStyle = `rgba(${particle.color || "229, 239, 225"}, ${clamp(particle.life, 0, 1)})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const perspectiveScale = 0.54 + (seaState.boatY / Math.max(1, height)) * 0.4;
    const boatScale = seaState.complete
      ? 0.35
      : perspectiveScale * (seaState.boosting ? 1.28 : 1) * (seaState.boatFlash ? 0.72 : 1);
    const boatX = seaState.complete ? width * 0.9 : width * 0.25;
    if (seaState.boosting && seaState.running) {
      ctx.save();
      ctx.strokeStyle = "rgba(240, 207, 145, .48)";
      ctx.lineWidth = 1;
      for (let trail = 0; trail < 3; trail += 1) {
        ctx.beginPath();
        ctx.moveTo(boatX - 34 - trail * 8, seaState.boatY - 7 + trail * 10);
        ctx.lineTo(boatX - 78 - trail * 12, seaState.boatY - 7 + trail * 10);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    if (seaState.boatFlash && Math.floor(seaState.boatFlash * 12) % 2) ctx.globalAlpha = 0.38;
    drawPaperBoat(ctx, boatX, seaState.boatY, boatScale, "#f4e6c7", seaState.time);
    ctx.restore();

    if (seaState.running) {
      ctx.fillStyle = "rgba(242, 218, 174, .7)";
      ctx.font = "10px Arial";
      ctx.fillText(currentLetter?.sender || "岩信", boatX - 17, seaState.boatY + 31);
    }
  }

  let seaLastFrame = 0;
  let seaAnimationFrame = 0;

  function startSeaLoop() {
    const seaIsVisible = document.visibilityState === "visible"
      && appShell.classList.contains("is-visible")
      && currentStage === 1;
    if (!seaIsVisible || seaAnimationFrame) return;
    seaState.lastTime = performance.now();
    seaAnimationFrame = requestAnimationFrame(seaLoop);
  }

  function seaLoop(now) {
    seaAnimationFrame = 0;
    const seaIsVisible = document.visibilityState === "visible"
      && appShell.classList.contains("is-visible")
      && currentStage === 1;
    if (!seaIsVisible) {
      seaState.lastTime = now;
      seaLastFrame = now;
      return;
    }
    const frameInterval = performanceLite ? 1000 / 30 : 1000 / 45;
    if (now - seaLastFrame < frameInterval) {
      seaAnimationFrame = requestAnimationFrame(seaLoop);
      return;
    }
    seaLastFrame = now;
    const delta = Math.min(0.05, (now - seaState.lastTime) / 1000);
    seaState.lastTime = now;
    updateSea(delta, now);
    renderSea();
    seaAnimationFrame = requestAnimationFrame(seaLoop);
  }

  function pointerToSea(event) {
    const rect = seaCanvas.getBoundingClientRect();
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    seaState.targetY = clamp(clientY - rect.top, 78, rect.height - 64);
  }

  seaCanvas.addEventListener("pointermove", pointerToSea);
  seaCanvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerToSea(event);
    setSeaBoost(true);
    if (seaCanvas.setPointerCapture && event.pointerId != null) seaCanvas.setPointerCapture(event.pointerId);
  });
  seaCanvas.addEventListener("touchmove", pointerToSea, { passive: true });

  function setSeaBoost(active) {
    seaInput.boost = active && seaState.running;
    $("#seaBoost").classList.toggle("is-active", seaInput.boost);
    $("#seaBoost").setAttribute("aria-pressed", String(seaInput.boost));
  }

  $("#seaBoost").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setSeaBoost(true);
  });
  window.addEventListener("pointerup", () => setSeaBoost(false));
  window.addEventListener("pointercancel", () => setSeaBoost(false));

  window.addEventListener("keydown", (event) => {
    if (currentStage !== 1 || !seaState.running) return;
    if (["ArrowUp", "w", "W"].includes(event.key)) {
      seaInput.up = true;
      event.preventDefault();
    }
    if (["ArrowDown", "s", "S"].includes(event.key)) {
      seaInput.down = true;
      event.preventDefault();
    }
    if (event.code === "Space") {
      setSeaBoost(true);
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (["ArrowUp", "w", "W"].includes(event.key)) seaInput.up = false;
    if (["ArrowDown", "s", "S"].includes(event.key)) seaInput.down = false;
    if (event.code === "Space") setSeaBoost(false);
  });

  function startVoyage() {
    if (!currentLetter) {
      goToStage(0);
      showToast("先落笔成信，纸舟才知道要去哪里");
      return;
    }
    seaState.running = true;
    seaState.complete = false;
    seaState.progress = 0;
    seaState.obstacles = [];
    seaState.particles = [];
    seaState.spawnTimer = 0.7;
    seaState.targetY = seaState.height * 0.57;
    seaState.boatY = seaState.height * 0.57;
    seaState.boatVelocity = 0;
    seaState.boatFlash = 0;
    seaState.score = 0;
    seaState.combo = 1;
    seaState.life = 3;
    seaState.energy = 100;
    seaState.memory = 0;
    seaState.memoryCollected = 0;
    seaState.shield = 0;
    seaState.nearMisses = 0;
    seaState.failed = false;
    seaState.lastCollision = 0;
    seaState.boosting = false;
    seaInput.up = false;
    seaInput.down = false;
    setSeaBoost(false);
    $("#straitArrival").classList.remove("is-visible");
    $("#straitArrival").setAttribute("aria-hidden", "true");
    $("#seaResult").hidden = true;
    $("#seaInstruction").classList.add("is-hidden");
    $("#seaStatus").textContent = "纸舟航行中";
    $("#startVoyage").textContent = "航行中 · 护信穿峡";
    $("#startVoyage").disabled = true;
    $("#seaBoost").disabled = false;
    $("#voyageBar").style.width = "0%";
    $("#voyageBoat").style.left = "0";
    $("#voyagePercent").textContent = "0%";
    $("#seaInstruction p").innerHTML = "移动掌舵 · 按住左键鼓帆<br><small>也可按住空格 · 集齐两枚乡音印</small>";
    updateSeaHud();
  }

  $("#startVoyage").addEventListener("click", startVoyage);
  $("#restartVoyage").addEventListener("click", startVoyage);

  function getStoredLetters() {
    try {
      return JSON.parse(localStorage.getItem("longmei-rock-letters") || "[]");
    } catch {
      return [];
    }
  }

  function storeLetter(letter) {
    const stored = getStoredLetters();
    if (!stored.some((item) => item.id === letter.id)) stored.push(letter);
    localStorage.setItem("longmei-rock-letters", JSON.stringify(stored.slice(-30)));
    updateLetterCount();
  }

  function completeVoyage() {
    if (seaState.memoryCollected < 2) {
      seaState.score += Math.floor(seaState.progress * 2);
      updateSeaHud();
      pauseVoyageAfterDamage(
        "已望见彼岸，还差一声乡音",
        `纸舟已经走完海峡，却只收集到 ${seaState.memoryCollected}/2 枚乡音印。循着闽南语的回声，再找一条回家的航线。`,
      );
      return;
    }
    seaState.running = false;
    seaState.complete = true;
    seaState.failed = false;
    seaState.obstacles = [];
    seaState.boosting = false;
    seaInput.boost = false;
    const finalScore = Math.floor(seaState.score + seaState.life * 420 + seaState.energy * 4);
    seaState.score = finalScore;
    updateSeaHud();
    $("#seaBoost").classList.remove("is-active");
    $("#seaBoost").setAttribute("aria-pressed", "false");
    $("#seaBoost").disabled = true;
    $("#seaStatus").textContent = "闽台相望 · 岩信抵岸";
    $("#startVoyage").textContent = "再渡一次 →";
    $("#startVoyage").disabled = false;
    $("#arrivalScore").textContent = finalScore.toLocaleString();
    $("#arrivalMemory").textContent = `${seaState.memoryCollected} 枚`;
    $("#straitArrival").classList.add("is-visible");
    $("#straitArrival").setAttribute("aria-hidden", "false");
    $("#seaResult").hidden = true;
    if (currentLetter) {
      currentLetter.voyageScore = finalScore;
      storeLetter(currentLetter);
      if (!currentLetter.secret) addLetterToWall(currentLetter, true);
    }
    showToast(currentLetter?.secret ? `密信穿过台湾海峡 · 岩信分 ${finalScore}` : `闽台相望，岩信抵岸 · 得分 ${finalScore}`);
  }

  $("#arrivalContinue").addEventListener("click", () => {
    $("#straitArrival").classList.remove("is-visible");
    $("#straitArrival").setAttribute("aria-hidden", "true");
    showToast("家书落成石纹，正在前往岩壁留存");
    goToStage(2);
    if (currentLetter && !currentLetter.secret) {
      $("#wallSearch").value = currentLetter.sender;
      performWallSearch(currentLetter.sender);
    }
  });

  // Generative Longmei Bay stone painting
  const rockArtCanvas = $("#rockArtCanvas");
  const rockArtContext = rockArtCanvas.getContext("2d");
  const rockArtPhase = $("#rockArtPhase");
  const rockArtState = {
    width: 0,
    height: 0,
    dpr: 1,
    pointerX: 0,
    pointerY: 0,
    targetX: 0,
    targetY: 0,
    particles: [],
    hasDrawn: false,
  };

  function makeRockParticles(count) {
    const random = seededRandom(240311);
    rockArtState.particles = Array.from({ length: count }, () => ({
      x: random(),
      y: random(),
      size: 0.5 + random() * 2.1,
      drift: 0.0015 + random() * 0.004,
      phase: random() * Math.PI * 2,
      tone: random(),
      alpha: 0.12 + random() * 0.32,
    }));
  }

  function resizeRockArt() {
    const rect = rockArtCanvas.getBoundingClientRect();
    rockArtState.width = Math.max(1, rect.width);
    rockArtState.height = Math.max(1, rect.height);
    rockArtState.dpr = performanceLite ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
    rockArtCanvas.width = Math.round(rockArtState.width * rockArtState.dpr);
    rockArtCanvas.height = Math.round(rockArtState.height * rockArtState.dpr);
    makeRockParticles(performanceLite ? 24 : 52);
    rockArtState.hasDrawn = false;
  }

  function smoothRockStep(start, end, value) {
    const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return amount * amount * (3 - 2 * amount);
  }

  function getRockArtPhase(time) {
    const progress = (time % 30) / 30;
    const appearing = smoothRockStep(0.18, 0.42, progress);
    const dissolving = 1 - smoothRockStep(0.64, 0.88, progress);
    return { progress, concrete: appearing * dissolving };
  }

  function irregularWave(value, seed, time) {
    return (
      Math.sin(value * 1.13 + seed * 2.17 + time * 0.045) * 0.54 +
      Math.sin(value * 2.83 - seed * 1.31 - time * 0.027) * 0.29 +
      Math.sin(value * 6.17 + seed * 4.71 + time * 0.016) * 0.12
    );
  }

  function longmeiProfile(ratio) {
    const leftHill = Math.exp(-Math.pow((ratio - 0.13) / 0.18, 2)) * 0.18;
    const centralReef = Math.exp(-Math.pow((ratio - 0.49) / 0.105, 2)) * 0.1;
    const rightCliff = Math.exp(-Math.pow((ratio - 0.83) / 0.15, 2)) * 0.28;
    const rockCrown = Math.exp(-Math.pow((ratio - 0.93) / 0.055, 2)) * 0.09;
    return 0.68 - leftHill - centralReef - rightCliff - rockCrown;
  }

  function drawStoneBands(ctx, width, height, time, concrete) {
    const palette = [
      "rgba(27, 72, 70, .24)",
      "rgba(107, 113, 94, .19)",
      "rgba(173, 146, 101, .15)",
      "rgba(46, 92, 85, .18)",
      "rgba(136, 112, 76, .13)",
    ];
    const step = Math.max(22, width / 58);
    ctx.save();
    ctx.globalAlpha = 0.95 - concrete * 0.56;
    for (let layer = 0; layer < 8; layer += 1) {
      const topBase = height * (0.02 + layer * 0.13);
      const bottomBase = topBase + height * (0.11 + (layer % 3) * 0.025);
      ctx.beginPath();
      for (let x = -step; x <= width + step; x += step) {
        const nx = x / width;
        const y = topBase + irregularWave(nx * 9, layer + 0.7, time) * height * (0.035 + layer * 0.004);
        if (x === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = width + step; x >= -step; x -= step) {
        const nx = x / width;
        ctx.lineTo(x, bottomBase + irregularWave(nx * 8.1, layer + 2.9, time) * height * 0.045);
      }
      ctx.closePath();
      ctx.fillStyle = palette[layer % palette.length];
      ctx.fill();
      ctx.strokeStyle = layer % 2 ? "rgba(227, 207, 168, .13)" : "rgba(105, 157, 145, .13)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMorphingContours(ctx, width, height, time, concrete) {
    const pointerX = rockArtState.pointerX * 12;
    const pointerY = rockArtState.pointerY * 7;
    for (let line = 0; line < 23; line += 1) {
      ctx.beginPath();
      const verticalOffset = (line - 11) * height * 0.026;
      for (let point = 0; point <= 92; point += 1) {
        const nx = point / 92;
        const x = nx * width + pointerX * (0.25 + line / 40);
        const abstractY =
          height * (0.04 + line * 0.042) +
          irregularWave(nx * 11.4, line * 0.63, time) * height * (0.055 + (line % 4) * 0.009) +
          Math.sin(nx * 25 + line * 1.7) * height * 0.009;
        const coastY =
          height * longmeiProfile(nx) +
          verticalOffset * (0.65 + Math.abs(nx - 0.5) * 0.7) +
          irregularWave(nx * 12, line + 8, time) * height * 0.009;
        const y = abstractY + (coastY - abstractY) * concrete + pointerY * (line / 22 - 0.5);
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const warmLine = line % 6 === 0;
      ctx.strokeStyle = warmLine
        ? `rgba(225, 190, 134, ${0.11 + concrete * 0.13})`
        : `rgba(167, 201, 180, ${0.1 + concrete * 0.1})`;
      ctx.lineWidth = line % 5 === 0 ? 1.15 : 0.65;
      ctx.stroke();
    }
  }

  function drawLongmeiFigure(ctx, width, height, time, concrete) {
    if (concrete < 0.015) return;
    const opacity = Math.pow(concrete, 1.55);
    ctx.save();
    ctx.globalAlpha = opacity;

    const shore = ctx.createLinearGradient(0, height * 0.35, 0, height);
    shore.addColorStop(0, "rgba(174, 159, 121, .05)");
    shore.addColorStop(1, "rgba(10, 35, 34, .42)");
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * longmeiProfile(0));
    for (let point = 1; point <= 100; point += 1) {
      const nx = point / 100;
      ctx.lineTo(nx * width, height * longmeiProfile(nx));
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = shore;
    ctx.fill();

    ctx.strokeStyle = "rgba(238, 218, 176, .42)";
    ctx.lineWidth = 1;
    for (let wave = 0; wave < 5; wave += 1) {
      ctx.beginPath();
      for (let point = 0; point <= 80; point += 1) {
        const nx = point / 80;
        const x = width * (0.24 + nx * 0.57);
        const y = height * (0.675 + wave * 0.035) + Math.sin(nx * 11 + wave * 1.8 + time * 0.18) * 3;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    const sunX = width * 0.64;
    const sunY = height * 0.29;
    const sunRadius = Math.min(width, height) * 0.055;
    ctx.beginPath();
    for (let point = 0; point <= 48; point += 1) {
      const angle = (point / 48) * Math.PI * 2;
      const rough = 1 + Math.sin(angle * 5 + time * 0.08) * 0.035;
      const x = sunX + Math.cos(angle) * sunRadius * rough;
      const y = sunY + Math.sin(angle) * sunRadius * rough;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(210, 111, 72, .56)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const boatX = width * 0.57 + Math.sin(time * 0.22) * 5;
    const boatY = height * 0.65 + Math.sin(time * 0.34) * 2;
    ctx.beginPath();
    ctx.moveTo(boatX - 25, boatY);
    ctx.lineTo(boatX, boatY + 12);
    ctx.lineTo(boatX + 29, boatY);
    ctx.moveTo(boatX, boatY + 10);
    ctx.lineTo(boatX, boatY - 25);
    ctx.lineTo(boatX + 19, boatY - 2);
    ctx.lineTo(boatX, boatY - 2);
    ctx.strokeStyle = "rgba(241, 221, 179, .72)";
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.restore();
  }

  function drawAbstractVeins(ctx, width, height, time, concrete) {
    ctx.save();
    ctx.globalAlpha = 1 - concrete * 0.72;
    for (let vein = 0; vein < 8; vein += 1) {
      ctx.beginPath();
      for (let point = 0; point <= 70; point += 1) {
        const ratio = point / 70;
        const x = width * (ratio + Math.sin(ratio * 7 + vein) * 0.025);
        const slope = vein % 2 ? ratio : 1 - ratio;
        const y = height * (0.08 + slope * 0.82) + irregularWave(ratio * 16, vein + 21, time) * height * 0.09 + vein * 4;
        if (point === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = vein === 3 ? "rgba(184, 75, 52, .34)" : "rgba(207, 193, 158, .105)";
      ctx.lineWidth = vein === 3 ? 1.25 : 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMineralWashes(ctx, width, height, time) {
    const washes = [
      { x: 0.23, y: 0.42, r: 0.38, color: [59, 113, 105], phase: 0.3 },
      { x: 0.72, y: 0.31, r: 0.34, color: [194, 158, 100], phase: 2.1 },
      { x: 0.62, y: 0.78, r: 0.31, color: [124, 70, 54], phase: 4.2 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    washes.forEach((wash, index) => {
      const x = width * wash.x + Math.sin(time * 0.035 + wash.phase) * width * 0.035;
      const y = height * wash.y + Math.cos(time * 0.027 + wash.phase) * height * 0.045;
      const radius = Math.max(width, height) * wash.r;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const alpha = index === 2 ? 0.1 : 0.16;
      gradient.addColorStop(0, `rgba(${wash.color.join(",")}, ${alpha})`);
      gradient.addColorStop(0.55, `rgba(${wash.color.join(",")}, ${alpha * 0.42})`);
      gradient.addColorStop(1, `rgba(${wash.color.join(",")}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    });
    ctx.restore();
  }

  function drawCinnabarVein(ctx, width, height, time, concrete) {
    ctx.save();
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += Math.max(18, width / 70)) {
      const ratio = x / width;
      const abstractY = height * (0.78 - ratio * 0.49) + irregularWave(ratio * 12, 31, time) * 20;
      const horizonY = height * 0.655 + Math.sin(ratio * 18 + time * 0.12) * 4;
      const y = abstractY + (horizonY - abstractY) * concrete;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(184, 75, 52, .34)";
    ctx.lineWidth = 1.3;
    ctx.shadowColor = "rgba(184, 75, 52, .24)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([2, 12]);
    ctx.strokeStyle = "rgba(228, 191, 130, .28)";
    ctx.lineWidth = 0.7;
    ctx.translate(0, 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawRockDust(ctx, width, height, time) {
    rockArtState.particles.forEach((particle) => {
      const yRatio = (particle.y + time * particle.drift) % 1;
      const x = width * particle.x + Math.sin(time * 0.09 + particle.phase) * 9;
      const y = height * yRatio;
      ctx.fillStyle = particle.tone > 0.76
        ? `rgba(188, 76, 51, ${particle.alpha * 0.65})`
        : `rgba(225, 210, 177, ${particle.alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderRockArt(timestamp) {
    const { width, height, dpr } = rockArtState;
    if (!width || !height) return;
    const ctx = rockArtContext;
    const time = reducedMotion ? 13.5 : timestamp / 1000;
    const phase = getRockArtPhase(time);
    rockArtState.pointerX += (rockArtState.targetX - rockArtState.pointerX) * 0.035;
    rockArtState.pointerY += (rockArtState.targetY - rockArtState.pointerY) * 0.035;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, rockArtCanvas.width, rockArtCanvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const veil = ctx.createLinearGradient(0, 0, width, height);
    veil.addColorStop(0, "rgba(7, 31, 31, .2)");
    veil.addColorStop(0.5, "rgba(13, 49, 47, .11)");
    veil.addColorStop(1, "rgba(26, 35, 31, .27)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, width, height);
    drawMineralWashes(ctx, width, height, time);
    drawStoneBands(ctx, width, height, time, phase.concrete);
    drawMorphingContours(ctx, width, height, time, phase.concrete);
    drawAbstractVeins(ctx, width, height, time, phase.concrete);
    drawLongmeiFigure(ctx, width, height, time, phase.concrete);
    drawCinnabarVein(ctx, width, height, time, phase.concrete);
    drawRockDust(ctx, width, height, time);
    if (phase.concrete < 0.16) rockArtPhase.textContent = "石纹漫游 · 无形";
    else if (phase.progress < 0.48) rockArtPhase.textContent = "龙美湾正在显影";
    else if (phase.progress < 0.68) rockArtPhase.textContent = "山海凝成一景";
    else rockArtPhase.textContent = "山海正在归岩";
    rockArtState.hasDrawn = true;
  }

  let rockArtLastFrame = 0;
  let rockArtAnimationFrame = 0;

  function startRockArtLoop() {
    const rockArtIsVisible = document.visibilityState === "visible"
      && appShell.classList.contains("is-visible")
      && currentStage === 2;
    if (!rockArtIsVisible || rockArtAnimationFrame) return;
    rockArtAnimationFrame = requestAnimationFrame(rockArtLoop);
  }

  function rockArtLoop(timestamp) {
    rockArtAnimationFrame = 0;
    const rockArtIsVisible = document.visibilityState === "visible"
      && appShell.classList.contains("is-visible")
      && currentStage === 2;
    if (!rockArtIsVisible) return;
    const frameInterval = performanceLite ? 1000 / 15 : 1000 / 24;
    const shouldDraw = !rockArtState.hasDrawn || (!reducedMotion && timestamp - rockArtLastFrame >= frameInterval);
    if (shouldDraw) {
      renderRockArt(timestamp);
      rockArtLastFrame = timestamp;
    }
    if (!reducedMotion) rockArtAnimationFrame = requestAnimationFrame(rockArtLoop);
  }

  function syncActiveRenderLoops() {
    startSeaLoop();
    startRockArtLoop();
  }

  $("#wall").addEventListener("pointermove", (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    rockArtState.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    rockArtState.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  $("#wall").addEventListener("pointerleave", () => {
    rockArtState.targetX = 0;
    rockArtState.targetY = 0;
  });

  // Rock wall archive
  const rockWall = $("#rockWall");
  const wallEmpty = $("#wallEmpty");
  const galleryStorageKey = "longmei-rock-letter-shoebox-v1";
  let rockRevealObserver = null;

  function inferRockTheme(message = "") {
    if (/团圆|归来|回来|重逢|回家/.test(message)) return "团圆";
    if (/平安|安好|珍重|康健|勿念|挂念/.test(message)) return "平安";
    if (/故乡|乡音|离家|海风|月光/.test(message)) return "思乡";
    return "牵挂";
  }

  function inferRockEmotion(message = "") {
    if (/盼|等|归|重逢/.test(message)) return "守望";
    if (/愿|平安|安好|珍重/.test(message)) return "祝福";
    return "思念";
  }

  function prepareRockMetadata(button, index = 0) {
    const message = button.dataset.message || button.querySelector("i")?.textContent?.replace(/[「」]/g, "") || "";
    const destination = button.dataset.destination || button.querySelector("small")?.textContent?.replace("寄往 · ", "") || "海峡彼岸";
    button.dataset.message = message;
    button.dataset.destination = destination;
    button.dataset.letterId ||= `archive-${String(index + 1).padStart(3, "0")}-${(button.dataset.name || "letter").replace(/\s/g, "")}`;
    button.dataset.theme ||= inferRockTheme(message);
    button.dataset.emotion ||= inferRockEmotion(message);
    button.dataset.material ||= ["龙美湾砂岩", "海蚀页岩", "金色风纹岩", "潮痕石英"][index % 4];
    button.style.setProperty("--archive-seed", String((index % 7) + 1));
  }

  function recordFromRock(button) {
    return {
      id: button.dataset.letterId,
      name: button.dataset.name || "无名旅人",
      recipient: button.dataset.recipient || "海的另一边",
      destination: button.dataset.destination || "海峡彼岸",
      message: button.dataset.message || "",
      theme: button.dataset.theme || "牵挂",
      emotion: button.dataset.emotion || "思念",
      material: button.dataset.material || "龙美湾岩纹",
    };
  }

  function loadGalleryLetters() {
    try {
      const parsed = JSON.parse(localStorage.getItem(galleryStorageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistGalleryLetters() {
    localStorage.setItem(galleryStorageKey, JSON.stringify(galleryLetters));
    renderGalleryDrawer();
  }

  function isLetterCollected(id) {
    return galleryLetters.some((letter) => letter.id === id);
  }

  function syncCollectButton() {
    if (!activeDetailLetter) return;
    const collected = isLetterCollected(activeDetailLetter.id);
    const button = $("#collectLetter");
    button.classList.toggle("is-collected", collected);
    button.querySelector("span").textContent = collected ? "✓" : "＋";
    button.querySelector("b").textContent = collected ? "已收藏 · 点击移出" : "收藏到我的家书盒";
  }

  function getRelatedRocks(record) {
    return $$(".rock-letter", rockWall)
      .filter((button) => button.dataset.letterId !== record.id)
      .map((button) => ({ button, record: recordFromRock(button) }))
      .sort((a, b) => {
        const score = (item) => (item.record.theme === record.theme ? 3 : 0) + (item.record.emotion === record.emotion ? 2 : 0) + (item.record.destination.includes(record.destination) || record.destination.includes(item.record.destination) ? 4 : 0);
        return score(b) - score(a);
      })
      .slice(0, 3);
  }

  function renderRelatedLetters(record) {
    const container = $("#relatedLetters");
    container.innerHTML = "";
    getRelatedRocks(record).forEach(({ button, record: related }) => {
      const item = document.createElement("button");
      item.type = "button";
      const theme = document.createElement("span");
      const name = document.createElement("b");
      const destination = document.createElement("small");
      theme.textContent = related.theme;
      name.textContent = related.name;
      destination.textContent = `寄往 · ${related.destination}`;
      item.append(theme, name, destination);
      item.addEventListener("click", () => openDetailForButton(button));
      container.appendChild(item);
    });
  }

  function openDetailRecord(record) {
    activeDetailLetter = record;
    $("#detailName").textContent = record.name;
    $("#detailRoute").textContent = `寄往 · ${record.recipient || record.destination}`;
    $("#detailMessage").textContent = record.message;
    $("#detailTheme").textContent = record.theme;
    $("#detailEmotion").textContent = record.emotion;
    $("#detailMaterial").textContent = record.material;
    $("#detailSpecimen").style.setProperty("--specimen-hue", String((record.id.length * 17) % 42 - 12));
    syncCollectButton();
    renderRelatedLetters(record);
    const modal = $("#letterDetailModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function openDetailForButton(button) {
    openDetailRecord(recordFromRock(button));
  }

  function addLetterToWall(letter, highlight = false) {
    if (letter.secret || $(`[data-letter-id="${CSS.escape(letter.id)}"]`, rockWall)) return;
    const userRockIndex = $$(".rock-letter--user", rockWall).length;
    const button = document.createElement("button");
    button.className = `rock-letter rock-letter--user rock-letter--user-${(userRockIndex % 4) + 1}${highlight ? " is-match" : ""}`;
    button.dataset.letterId = letter.id;
    button.dataset.name = letter.sender;
    button.dataset.recipient = letter.recipient;
    button.dataset.destination = letter.recipient;
    button.dataset.message = letter.message;
    const name = document.createElement("span");
    name.textContent = letter.sender;
    const route = document.createElement("small");
    route.textContent = `寄往 · ${letter.recipient}`;
    const quote = document.createElement("i");
    quote.textContent = `「${[...letter.message].slice(0, 18).join("")}${letter.message.length > 18 ? "…" : ""}」`;
    button.append(name, route, quote);
    rockWall.appendChild(button);
    prepareRockMetadata(button, $$(".rock-letter", rockWall).length - 1);
    bindRockLetter(button);
    rockRevealObserver?.observe(button);
    updateLetterCount();
    if (highlight) setTimeout(() => button.classList.remove("is-match"), 3800);
  }

  function bindRockLetter(button) {
    button.addEventListener("click", () => openDetailForButton(button));
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--rock-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      button.style.setProperty("--rock-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    });
  }

  $$(".rock-letter", rockWall).forEach((button, index) => {
    prepareRockMetadata(button, index);
    bindRockLetter(button);
  });

  galleryLetters = loadGalleryLetters();

  const wallFilterButtons = $$("[data-wall-filter]");
  let activeWallFilter = "all";

  function applyWallArchiveFilter(rawQuery = "", announce = false) {
    const query = rawQuery.trim().toLowerCase();
    const letters = $$(".rock-letter", rockWall);
    wallEmpty.hidden = true;
    rockWall.classList.toggle("has-filter", Boolean(query || activeWallFilter !== "all"));
    let matches = 0;
    letters.forEach((letter) => {
      const nameMatch = !query || (letter.dataset.name || "").toLowerCase().includes(query);
      const destination = letter.dataset.destination || letter.querySelector("small")?.textContent || "";
      const routeMatch = activeWallFilter === "all" || destination.includes(activeWallFilter);
      const visible = nameMatch && routeMatch;
      letter.classList.toggle("is-filtered", !visible);
      letter.classList.toggle("is-match", Boolean(query && visible));
      if (visible) matches += 1;
    });

    $("#wallResultCount").textContent = matches.toString();
    $("#wallResultSummary span").textContent = query
      ? `检索“${rawQuery.trim()}”`
      : activeWallFilter === "all"
        ? "当代岩信档案"
        : `${activeWallFilter}去向档案`;

    if (matches === 0) {
      wallEmpty.hidden = false;
      if (announce) showToast("岩壁没有回应，也许这封信还未启程");
    } else if (announce && query) {
      showToast(`找到了 ${matches} 封属于“${rawQuery.trim()}”的岩信`);
    }
    return matches;
  }

  function performWallSearch(rawQuery) {
    applyWallArchiveFilter(rawQuery, Boolean(rawQuery.trim()));
  }

  $("#wallSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    performWallSearch($("#wallSearch").value);
  });

  $("#wallSearch").addEventListener("input", (event) => {
    applyWallArchiveFilter(event.target.value);
  });

  wallFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeWallFilter = button.dataset.wallFilter || "all";
      wallFilterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      const visibleCount = applyWallArchiveFilter($("#wallSearch").value);
      showToast(activeWallFilter === "all" ? `正在浏览全部 ${visibleCount} 封公开岩信` : `${activeWallFilter}方向，共 ${visibleCount} 封岩信`);
    });
  });

  const archiveModeButtons = $$('[data-archive-mode]');
  let activeArchiveMode = "explore";
  let archivePulseTimer = null;

  function pulseArchiveDiscovery() {
    clearInterval(archivePulseTimer);
    archivePulseTimer = setInterval(() => {
      if (currentStage !== 2 || activeArchiveMode !== "explore" || $("#letterDetailModal").classList.contains("is-open")) return;
      const visible = $$(".rock-letter:not(.is-filtered)", rockWall);
      if (!visible.length) return;
      visible.forEach((letter) => letter.classList.remove("is-curated-focus"));
      visible[Math.floor(Math.random() * visible.length)].classList.add("is-curated-focus");
    }, 3100);
  }

  function setArchiveMode(mode) {
    activeArchiveMode = mode;
    archiveModeButtons.forEach((button) => {
      const active = button.dataset.archiveMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    rockWall.classList.toggle("is-journey-mode", mode === "journey");
    rockWall.classList.toggle("is-search-mode", mode === "search");
    const hints = {
      explore: "滚动时，远处岩信会淡出简化；靠近视线中心时，字迹与石纹逐层显影。",
      search: "输入姓名，或按台湾、金门、澎湖与泉州去向筛选；结果会在岩壁上重新编排。",
      journey: "家书按出发与抵岸顺序展开，横向的金线提示侨批迁徙与归乡路径。",
    };
    $("#archiveModeHint").textContent = hints[mode];
    if (mode === "search") setTimeout(() => $("#wallSearch").focus({ preventScroll: true }), 260);
    if (mode === "explore") pulseArchiveDiscovery();
    else clearInterval(archivePulseTimer);
    updateRockLetterLOD();
  }

  archiveModeButtons.forEach((button) => button.addEventListener("click", () => setArchiveMode(button.dataset.archiveMode)));
  pulseArchiveDiscovery();

  const archiveSeedLetters = [
    { id: "echo-001", sender: "林玉真", recipient: "台北的阿姊", message: "月光落在龙美湾，也照着你窗前。见字如面，家中安好。" },
    { id: "echo-002", sender: "陈海舟", recipient: "澎湖旧友", message: "潮水替我问候，盼来年回乡再叙。伏望珍重。" },
    { id: "echo-003", sender: "蔡秋月", recipient: "金门父亲", message: "离家虽远，乡音未改。毋须挂念，愿父亲身体康健。" },
    { id: "echo-004", sender: "王念祖", recipient: "台南故人", message: "一纸越海，千言未尽。待燕归来，我们在故乡重逢。" },
    { id: "echo-005", sender: "黄庭安", recipient: "高雄阿嬷", message: "龙美湾今日风轻，家中近况安稳，顺颂安康。" },
    { id: "echo-006", sender: "苏海玲", recipient: "泉州母亲", message: "走得再远，仍记得门前茶香。盼早日归来团圆。" },
    { id: "echo-007", sender: "庄清河", recipient: "台湾海峡彼岸", message: "同一轮月光照两岸，愿乡音替我抵达。" },
    { id: "echo-008", sender: "许瑞云", recipient: "金门同窗", message: "别后数载，思念甚切。愿你平安顺遂，雁字早回。" },
    { id: "echo-009", sender: "郑归帆", recipient: "澎湖家人", message: "海风认得归帆，家书也认得回家的路。" },
    { id: "echo-010", sender: "洪月娥", recipient: "台中女儿", message: "家中一切都好，勿念。伏望珍重，盼早日团圆。" },
    { id: "echo-011", sender: "林潮生", recipient: "厦门兄长", message: "见字如晤，旧日石廊仍在，等你归来共看潮生。" },
    { id: "echo-012", sender: "陈安澜", recipient: "新竹友人", message: "山海有距，文脉相牵。愿此信替我报一声平安。" },
  ];
  let archiveSeedIndex = 0;

  $("#expandArchive").addEventListener("click", () => {
    const nextBatch = archiveSeedLetters.slice(archiveSeedIndex, archiveSeedIndex + 4);
    if (!nextBatch.length) return;
    const beforeCount = $$(".rock-letter", rockWall).length;
    nextBatch.forEach((letter) => addLetterToWall({ ...letter, secret: false }));
    archiveSeedIndex += nextBatch.length;
    $$(".rock-letter", rockWall).slice(beforeCount).forEach((letter, index) => {
      letter.classList.add("is-stream-born");
      setTimeout(() => letter.classList.remove("is-stream-born"), 900 + index * 120);
    });
    applyWallArchiveFilter($("#wallSearch").value);
    $("#archiveStreamHint").textContent = archiveSeedIndex >= archiveSeedLetters.length
      ? "本期世代长卷已全部显影"
      : `已显影 ${archiveSeedIndex} 封 · 继续展开下一组`;
    if (archiveSeedIndex >= archiveSeedLetters.length) {
      $("#expandArchive").classList.add("is-complete");
      $("#expandArchive").disabled = true;
    }
    showToast(`海雾展开，${nextBatch.length} 封关联岩信汇入长卷`);
    updateRockLetterLOD();
  });

  function updateRockLetterLOD() {
    const wallRect = $("#wall").getBoundingClientRect();
    const centerY = Math.max(0, wallRect.top) + Math.min(window.innerHeight, wallRect.bottom) * 0.52;
    $$(".rock-letter:not(.is-filtered)", rockWall).forEach((letter) => {
      const rect = letter.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - centerY);
      const closeness = clamp(1 - distance / Math.max(320, window.innerHeight * 0.72), 0, 1);
      const normalized = activeArchiveMode === "journey" ? Math.max(0.78, closeness) : closeness;
      letter.style.setProperty("--lod-opacity", (0.48 + normalized * 0.52).toFixed(3));
      letter.style.setProperty("--lod-blur", `${((1 - normalized) * 0.72).toFixed(2)}px`);
      letter.style.setProperty("--lod-light", (0.84 + normalized * 0.23).toFixed(3));
    });
  }

  let wallLodTicking = false;
  $("#wall").addEventListener("scroll", () => {
    if (wallLodTicking) return;
    wallLodTicking = true;
    requestAnimationFrame(() => {
      updateRockLetterLOD();
      wallLodTicking = false;
    });
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    rockRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-revealed", entry.isIntersecting));
    }, { root: $("#wall"), threshold: 0.12, rootMargin: "80px 0px" });
    $$(".rock-letter", rockWall).forEach((letter) => rockRevealObserver.observe(letter));
  } else {
    $$(".rock-letter", rockWall).forEach((letter) => letter.classList.add("is-revealed"));
  }

  function renderGalleryDrawer() {
    const list = $("#galleryList");
    list.innerHTML = "";
    $("#galleryCount").textContent = galleryLetters.length;
    $("#galleryFooterCount").textContent = `${galleryLetters.length} 封岩信`;
    $("#galleryEmpty").hidden = galleryLetters.length > 0;
    galleryLetters.forEach((letter, index) => {
      const item = document.createElement("article");
      item.className = "gallery-item";
      const openButton = document.createElement("button");
      const number = document.createElement("span");
      const copy = document.createElement("div");
      const name = document.createElement("b");
      const destination = document.createElement("small");
      const excerpt = document.createElement("p");
      const removeButton = document.createElement("button");

      openButton.type = "button";
      openButton.className = "gallery-item__open";
      number.textContent = String(index + 1).padStart(2, "0");
      name.textContent = letter.name;
      destination.textContent = `寄往 · ${letter.destination}`;
      excerpt.textContent = `「${[...letter.message].slice(0, 24).join("")}${letter.message.length > 24 ? "…" : ""}」`;
      copy.append(name, destination, excerpt);
      openButton.append(number, copy);

      removeButton.type = "button";
      removeButton.className = "gallery-item__remove";
      removeButton.setAttribute("aria-label", `移出${letter.name}的岩信`);
      removeButton.textContent = "×";
      item.append(openButton, removeButton);

      openButton.addEventListener("click", () => {
        closeGalleryDrawer();
        openDetailRecord(letter);
      });
      removeButton.addEventListener("click", () => {
        galleryLetters = galleryLetters.filter((saved) => saved.id !== letter.id);
        persistGalleryLetters();
        syncCollectButton();
      });
      list.appendChild(item);
    });
  }

  function openGalleryDrawer() {
    renderGalleryDrawer();
    $("#galleryDrawer").classList.add("is-open");
    $("#galleryDrawer").setAttribute("aria-hidden", "false");
  }

  function closeGalleryDrawer() {
    $("#galleryDrawer").classList.remove("is-open");
    $("#galleryDrawer").setAttribute("aria-hidden", "true");
  }

  $("#myGalleryButton").addEventListener("click", openGalleryDrawer);
  $$('[data-close-gallery]').forEach((button) => button.addEventListener("click", closeGalleryDrawer));

  $("#collectLetter").addEventListener("click", () => {
    if (!activeDetailLetter) return;
    if (isLetterCollected(activeDetailLetter.id)) {
      galleryLetters = galleryLetters.filter((letter) => letter.id !== activeDetailLetter.id);
      showToast("已从我的家书盒移出");
    } else {
      galleryLetters.unshift(activeDetailLetter);
      showToast("已收藏到我的家书盒 · 无需登录");
    }
    persistGalleryLetters();
    syncCollectButton();
  });

  async function copyCuratedLink(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
      showToast(successMessage);
    }
  }

  $("#shareLetterLink").addEventListener("click", () => {
    if (!activeDetailLetter) return;
    const base = window.location.href.split("#")[0];
    copyCuratedLink(`${base}#rock=${encodeURIComponent(activeDetailLetter.id)}`, "专属调阅链接已复制 · 可分享给想念的人");
  });

  $("#shareGallery").addEventListener("click", () => {
    if (!galleryLetters.length) return showToast("先收藏一封岩信，再生成策展清单");
    const base = window.location.href.split("#")[0];
    const ids = galleryLetters.map((letter) => encodeURIComponent(letter.id)).join(",");
    copyCuratedLink(`${base}#shoebox=${ids}`, "我的家书盒链接已复制 · 无需登录即可分享");
  });

  const specimen = $("#detailSpecimen");
  let specimenDragging = false;
  specimen.addEventListener("pointerdown", (event) => {
    specimenDragging = true;
    specimen.setPointerCapture?.(event.pointerId);
    specimen.classList.add("is-dragging");
  });
  specimen.addEventListener("pointermove", (event) => {
    if (!specimenDragging && event.pointerType !== "mouse") return;
    const rect = specimen.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    specimen.style.setProperty("--specimen-ry", `${(x - 0.5) * 32}deg`);
    specimen.style.setProperty("--specimen-rx", `${(0.5 - y) * 22}deg`);
    specimen.style.setProperty("--specimen-light-x", `${x * 100}%`);
    specimen.style.setProperty("--specimen-light-y", `${y * 100}%`);
  });
  const releaseSpecimen = () => {
    specimenDragging = false;
    specimen.classList.remove("is-dragging");
  };
  specimen.addEventListener("pointerup", releaseSpecimen);
  specimen.addEventListener("pointercancel", releaseSpecimen);

  renderGalleryDrawer();
  setArchiveMode("explore");
  updateRockLetterLOD();

  $("#writeFromEmpty").addEventListener("click", () => goToStage(0));

  function closeDetail() {
    const modal = $("#letterDetailModal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  $$('[data-close-detail]').forEach((item) => item.addEventListener("click", closeDetail));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closePoster();
    closeDetail();
    phrasePopover.hidden = true;
  });

  function updateLetterCount() {
    const count = 2368 + getStoredLetters().length;
    $("#letterCount").textContent = count.toLocaleString("zh-CN");
    $("#wallArchiveCount").textContent = count.toLocaleString("zh-CN");
    const publicLetters = $$(".rock-letter", rockWall);
    $("#wallPublicCount").textContent = publicLetters.length.toString().padStart(2, "0");
    const destinations = new Set(publicLetters.map((letter) => letter.dataset.destination || letter.querySelector("small")?.textContent || "").filter(Boolean));
    $("#wallRouteCount").textContent = destinations.size.toString().padStart(2, "0");
    if (!rockWall.classList.contains("has-filter")) $("#wallResultCount").textContent = publicLetters.length.toString();
  }

  getStoredLetters().filter((letter) => !letter.secret).forEach((letter) => addLetterToWall(letter));
  updateLetterCount();
  applyWallArchiveFilter("");
  setActiveStage(0);
  resizeSea();
  updateSeaHud();
  resizeRockArt();
  window.addEventListener("resize", () => {
    resizeSea();
    resizeRockArt();
    updateRockLetterLOD();
    syncActiveRenderLoops();
  });
  document.addEventListener("visibilitychange", () => {
    attemptMusicAutoplay();
    syncActiveRenderLoops();
  });

  function openSharedArchiveTarget() {
    const hash = decodeURIComponent(window.location.hash || "");
    if (!hash.startsWith("#rock=") && !hash.startsWith("#shoebox=")) return;
    welcome.classList.add("is-entering");
    activityHub.classList.remove("is-visible");
    activityHub.setAttribute("aria-hidden", "true");
    appShell.classList.add("is-visible");
    appShell.setAttribute("aria-hidden", "false");
    goToStage(2);
    setTimeout(() => {
      if (hash.startsWith("#rock=")) {
        const id = hash.slice(6);
        const button = $(`[data-letter-id="${CSS.escape(id)}"]`, rockWall);
        const saved = galleryLetters.find((letter) => letter.id === id);
        if (button) openDetailForButton(button);
        else if (saved) openDetailRecord(saved);
        else showToast("这封岩信尚未在当前设备显影");
      } else {
        openGalleryDrawer();
      }
    }, 760);
  }

  setTimeout(openSharedArchiveTarget, 180);
  window.addEventListener("hashchange", openSharedArchiveTarget);
  syncActiveRenderLoops();
})();

window.__commands = {
  help() {
    return [
      '═══════════ 可用指令 ═══════════',
      '',
      '  status         系统状态摘要',
      '  scan           扫描活动节点 (触发动效)',
      '  alert <0-4>    设置告警级别 (0=清除)',
      `  kill <node>     关闭指定节点 (${Object.keys(nodeStates).join('/')})`,
      `  revive <node>   恢复指定节点`,
      '  reboot         系统重启序列',
      '  theme <name>   切换主题 (cyber/neon/matrix)',
      '  logs [n]       显示最近 n 条日志',
      '  clear          清空终端',
      '  version        版本信息',
      '  turtle         打开 turtlesim 海龟仿真面板',
      '  help           显示此帮助',
      '',
      '═══════ turtlesim 海龟控制 ═══════',
      '',
      '  打开面板后，使用 ros2 命令控制海龟:',
      '',
      '  # 发送速度指令 (开车!)',
      '  ros2 topic pub /turtle1/cmd_vel',
      '    geometry_msgs/msg/Twist',
      '    "{linear: {x: 2.0}, angular: {z: 1.0}}"',
      '',
      '  # 直线前进',
      '  ros2 topic pub /turtle1/cmd_vel',
      '    geometry_msgs/msg/Twist',
      '    "{linear: {x: 3.0}, angular: {z: 0.0}}"',
      '',
      '  # 原地旋转',
      '  ros2 topic pub /turtle1/cmd_vel',
      '    geometry_msgs/msg/Twist',
      '    "{linear: {x: 0.0}, angular: {z: 2.0}}"',
      '',
      '  # 停止',
      '  ros2 topic pub /turtle1/cmd_vel',
      '    geometry_msgs/msg/Twist',
      '    "{linear: {x: 0.0}, angular: {z: 0.0}}"',
      '',
      '  # 换画笔颜色 (r/g/b 0-255)',
      '  ros2 service call /turtle1/set_pen',
      '    turtlesim/srv/SetPen',
      '    "{r: 255, g: 0, b: 170, width: 3, off: 0}"',
      '',
      '  # 瞬移到指定位置',
      '  ros2 service call /turtle1/teleport_absolute',
      '    turtlesim/srv/TeleportAbsolute',
      '    "{x: 2.0, y: 1.0, theta: 0.5}"',
      '',
      '  # 清除画布',
      '  ros2 service call /clear std_srvs/srv/Empty',
      '',
      '  # 重置仿真',
      '  ros2 service call /reset std_srvs/srv/Empty',
      '',
      '  # 查看海龟位姿',
      '  ros2 topic echo /turtle1/pose',
      '',
      '  # 彩虹画笔 (颜色自动循环)',
      '  ros2 service call /turtle1/set_rainbow',
      '    turtlesim/srv/SetRainbow',
      '    "{on: 1}"',
      '',
      '  # 镜像/万花筒模式 (4向或8向)',
      '  ros2 service call /turtle1/set_mirror',
      '    turtlesim/srv/SetMirror',
      '    "{mode: 4}"',
      '',
      '  ⌨️ 快捷键: WASD/方向键 驾驶 | R彩虹 M镜像 C清除 Space停',
      '  🖱️ 点击画布 → 海龟自动导航',
      '',
      '════════════════════════════════',
    ].join('\n');
  },

  status() {
    flashElement('#sidebar');
    addAlertLog('执行 status 检查', 'text-gray-500');
    return [
      '══════════════════════════════',
      ' SYSTEM STATUS REPORT',
      '──────────────────────────────',
      ` CPU:     ${document.getElementById('statCpu').textContent}`,
      ` Memory:  ${document.getElementById('statMem').textContent}`,
      ` Network: ${document.getElementById('statNet').textContent}`,
      ` Uptime:  ${document.getElementById('statUptime').textContent}`,
      ` Core:    ${document.getElementById('statTemp').textContent}`,
      '──────────────────────────────',
      ` 在线节点: ${Object.values(nodeStates).filter(Boolean).length}/${Object.keys(nodeStates).length}`,
      ` 当前主题: ${currentTheme}`,
      ' 状态: NOMINAL',
      '══════════════════════════════',
    ].join('\n');
  },

  scan() {
    // Animated scan effect
    const lines = ['发起系统扫描...', ''];
    const nodes = Object.keys(nodeStates);
    const colors = [];
    nodes.forEach((n) => {
      const online = nodeStates[n];
      const s = online ? 'ONLINE' : 'OFFLINE';
      const marker = online ? '✓' : '✗';
      lines.push(`  ${marker} ${n} ...... ${s}`);
      colors.push(online ? 'text-cyber-green' : 'text-cyber-red');
    });
    lines.push('', '扫描完成: ' + Object.values(nodeStates).filter(Boolean).length + ' 在线, ' + Object.values(nodeStates).filter(v=>!v).length + ' 离线');

    // Flash each chart as scan "hits" them
    setTimeout(() => { flashElement('#chartLoad'); addAlertLog('扫描数据总线...', 'text-cyber-cyan'); }, 300);
    setTimeout(() => { flashElement('#chartTasks'); addAlertLog('扫描任务队列...', 'text-cyber-cyan'); }, 800);
    setTimeout(() => { flashElement('#chartRadar'); addAlertLog('扫描能力矩阵...', 'text-cyber-cyan'); }, 1300);
    addAlertLog('执行全系统扫描', 'text-gray-500');

    return lines.join('\n');
  },

  alert(level = '2') {
    const lv = parseInt(level);
    if (isNaN(lv) || lv < 0 || lv > 4) return '错误: 告警级别范围 0-4 (0=清除)';
    updateAlertLevel(lv === 0 ? 'off' : String(lv));
    const labels = { 0: 'CLEAR', 1: 'INFO', 2: 'WARNING', 3: 'CRITICAL', 4: 'EMERGENCY' };
    addAlertLog(`告警级别变更 → ${labels[lv]}`, lv >= 3 ? 'text-cyber-red' : lv >= 2 ? 'text-cyber-amber' : 'text-cyber-green');
    flashElement('header .flex.items-center.gap-6', 400);
    return `告警级别已设置为: ${labels[lv]} (LV.${lv})`;
  },

  kill(node = '') {
    const id = node.toUpperCase();
    if (!id || !(id in nodeStates)) return `错误: 无效节点 "${node}" — 可用: ${Object.keys(nodeStates).join(', ')}`;
    if (!nodeStates[id]) return `节点 ${id} 已经处于离线状态`;
    setNodeStatus(id, false);
    addAlertLog(`节点 ${id} 已手动关闭`, 'text-cyber-red');
    flashElement('#chartTasks');
    return `⚠ 节点 ${id} 已关闭 — 动力切断, 任务重新分配\n当前在线: ${Object.values(nodeStates).filter(Boolean).length}/${Object.keys(nodeStates).length}`;
  },

  revive(node = '') {
    const id = node.toUpperCase();
    if (!id || !(id in nodeStates)) return `错误: 无效节点 "${node}" — 可用: ${Object.keys(nodeStates).join(', ')}`;
    if (nodeStates[id]) return `节点 ${id} 已经处于在线状态`;
    setNodeStatus(id, true);
    addAlertLog(`节点 ${id} 已恢复上线`, 'text-cyber-green');
    flashElement('#chartTasks');
    return `✓ 节点 ${id} 已恢复 — 动力恢复, 任务接入\n当前在线: ${Object.values(nodeStates).filter(Boolean).length}/${Object.keys(nodeStates).length}`;
  },

  reboot() {
    doReboot();
    addAlertLog('用户发起系统重启', 'text-cyber-amber');
    return '系统重启中... 请稍候';
  },

  theme(name = '') {
    const valid = ['cyber', 'neon', 'matrix'];
    if (!name || !valid.includes(name)) return `用法: theme <${valid.join('|')}> — 当前: ${currentTheme}`;
    switchTheme(name);
    addAlertLog(`主题切换 → ${name.toUpperCase()}`, 'text-cyber-cyan');
    return `主题已切换为: ${name.toUpperCase()}`;
  },

  logs(n = 5) {
    const mockLogs = [
      '[22:41:03] INFO  陀螺仪校准完成 (drift=0.02)',
      '[22:38:12] WARN  关节-3 扭矩峰值 4.2N·m (阈值 4.0)',
      '[22:30:00] INFO  固件校验通过 — checksum OK',
      '[22:15:44] INFO  环境传感器上线 — temp=22°C',
      '[21:58:01] INFO  动力总线初始化 — 2400ms',
      '[21:42:17] DEBUG 路径规划缓存清除 — 384 entries',
      '[21:30:00] INFO  每日自检通过 — all modules nominal',
      '[21:12:05] DEBUG IMU零偏补偿 — avg=0.003',
      '[20:55:33] WARN  电池单元 #4 电压偏差 0.08V',
      '[20:30:00] INFO  轮替任务调度器启动',
    ];
    return mockLogs.slice(0, Math.min(Number(n), mockLogs.length)).join('\n');
  },

  version() {
    return 'CYBER-CORE v2.5.0 — Build 2026-05-11T23:00 — Kernel 6.12.0-rc7';
  },

  // --- ROS2 CLI Simulator ---
  // --- ROS2 CLI Simulator ---
  ros2(...args) {
    if (!args.length) return '用法: ros2 <subcommand> [...] — 输入 ros2 help 查看详情';
    if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') return this._ros2Help();
    const sub = args[0], rest = args.slice(1);
    if (bridgeConnected) {
      bridgeRos2Cmd(sub, rest).then(function(res) {
        if (res && res.simulated === false && res.output) appendOutput('result', res.output);
      });
      return '> ROS2 Bridge: ' + sub + ' ' + rest.join(' ') + ' ...';
    }
    const handlers = { node:'_ros2Node', topic:'_ros2Topic', service:'_ros2Service', action:'_ros2Action', param:'_ros2Param', launch:'_ros2Launch', run:'_ros2Run', bag:'_ros2Bag' };
    if (handlers[sub]) return this[handlers[sub]](rest);
    return `未知 ros2 子命令: "${sub}" — 输入 ros2 help 查看可用命令`;
  },

  _ros2Help() {
    return [
      'ROS2 CLI 仿真命令:',
      '  ros2 node list                 列出节点',
      '  ros2 node info <name>          节点详情',
      '  ros2 topic list                列出话题',
      '  ros2 topic echo <topic>        实时数据流 (Ctrl+C 停止)',
      '  ros2 topic hz <topic>          发布频率',
      '  ros2 topic pub <topic> <type> <data>  发布消息',
      '  ros2 service list              列出服务',
      '  ros2 service call <srv> <type> <data> 调用服务',
      '  ros2 action list               列出动作',
      '  ros2 action send_goal <act> <type> <data> 发送目标',
      '  ros2 param list                列出参数',
      '  ros2 param get <node> <key>    获取参数',
      '  ros2 param set <node> <key> <val> 设置参数',
      '  ros2 launch <pkg> <file>       启动包',
      '  ros2 run <pkg> <exec>          运行节点',
      '  ros2 bag record <topics>       录制数据',
      '',
      '常用话题: /rx/cmd_vel  /rx/joint_states  /rx/imu  /rx/laser  /rx/camera',
      '常用服务: /rx/emergency_stop  /rx/set_mode  /rx/calibrate',
    ].join('\n');
  },

  _ros2Node(rest) {
    if (rest[0] === 'list') {
      flashElement('#sidebar');
      const rxnodes = Object.keys(nodeStates).map(n => {
        const online = nodeStates[n];
        return `  ${online ? '✓' : '✗'} ${n}  [${online ? 'online' : 'offline'}]`;
      }).join('\n');
      return `活动节点:\n${rxnodes}\n  ────\n  ✓ cyber_core  [online]\n  ✓ telemetry_bridge  [online]\n  ✓ cmd_router  [online]\n\n共 ${Object.keys(nodeStates).filter(k=>nodeStates[k]).length + 3} 个节点在线`;
    }
    if (rest[0] === 'info' && rest[1]) {
      const n = rest[1].toUpperCase();
      if (nodeStates[n] !== undefined) {
        const s = nodeStates[n] ? 'online' : 'offline';
        return `节点: ${n}\n  状态: ${s}\n  订阅: /rx/cmd_vel, /rx/params\n  发布: /rx/joint_states, /rx/${n.toLowerCase()}/status\n  服务: /rx/set_mode, /rx/calibrate`;
      }
      return `节点 "${rest[1]}" 未找到 — 使用 ros2 node list 查看`;
    }
    return '用法: ros2 node list | info <name>';
  },

  _ros2Topic(rest) {
    if (rest[0] === 'list') {
      flashElement('#chartLoad');
      return [
        '活动话题:',
        '  /rx/cmd_vel            [geometry_msgs/msg/Twist]',
        '  /rx/joint_states       [sensor_msgs/msg/JointState]',
        '  /rx/imu                [sensor_msgs/msg/Imu]',
        '  /rx/laser              [sensor_msgs/msg/LaserScan]',
        '  /rx/camera             [sensor_msgs/msg/Image]',
        '  /rx/odom               [nav_msgs/msg/Odometry]',
        '  /rx/temperature        [sensor_msgs/msg/Temperature]',
        '  /rx/battery            [sensor_msgs/msg/BatteryState]',
        '  /rx/emergency          [std_msgs/msg/Bool]',
        '  /rx/diagnostics        [diagnostic_msgs/msg/DiagnosticArray]',
        '  /parameter_events      [rcl_interfaces/msg/ParameterEvent]',
        '  ─── turtlesim ───',
        '  /turtle1/cmd_vel       [geometry_msgs/msg/Twist]',
        '  /turtle1/pose          [turtlesim/msg/Pose]',
      ].join('\n');
    }
    if (rest[0] === 'echo' && rest[1]) {
      const topic = rest[1];
      const data = this._topicEcho(topic);
      if (!data) return `话题 "${topic}" 不存在 — 使用 ros2 topic list 查看`;
      flashElement('#chartLoad');
      return data;
    }
    if (rest[0] === 'hz' && rest[1]) {
      const rates = { '/rx/cmd_vel':'100.2 Hz','/rx/joint_states':'200.0 Hz','/rx/imu':'400.5 Hz','/rx/laser':'30.0 Hz','/rx/camera':'30.1 Hz','/rx/odom':'100.0 Hz','/rx/temperature':'10.0 Hz','/rx/battery':'1.0 Hz' };
      return rates[rest[1]] ? `话题 ${rest[1]} 平均频率: ${rates[rest[1]]} (最近 1000 条消息)` : `话题 "${rest[1]}" 不存在`;
    }
    if (rest[0] === 'pub' && rest[1]) {
      return this._topicPub(rest.slice(1));
    }
    return '用法: ros2 topic list | echo <topic> | hz <topic> | pub <topic> <type> <data>';
  },

  _ros2Service(rest) {
    if (rest[0] === 'list') {
      return [
        '可用服务:',
        '  /rx/emergency_stop     [std_srvs/srv/Trigger]',
        '  /rx/set_mode           [rx_msgs/srv/SetMode]',
        '  /rx/calibrate          [rx_msgs/srv/Calibrate]',
        '  /rx/reset_odom         [std_srvs/srv/Trigger]',
        '  /rx/enable_motor       [std_srvs/srv/SetBool]',
        '  ─── turtlesim ───',
        '  /clear                 [std_srvs/srv/Empty]',
        '  /reset                 [std_srvs/srv/Empty]',
        '  /turtle1/set_pen       [turtlesim/srv/SetPen]',
        '  /turtle1/teleport_absolute [turtlesim/srv/TeleportAbsolute]',
        '  /turtle1/teleport_relative [turtlesim/srv/TeleportRelative]',
      ].join('\n');
    }
    if (rest[0] === 'call' && rest[1]) {
      return this._serviceCall(rest.slice(1));
    }
    return '用法: ros2 service list | call <srv> <type> <data>';
  },

  _ros2Action(rest) {
    if (rest[0] === 'list') {
      return [
        '可用动作:',
        '  /rx/navigate_to_pose   [nav2_msgs/action/NavigateToPose]',
        '  /rx/manipulate         [rx_msgs/action/Manipulate]',
        '  /rx/dock               [rx_msgs/action/Dock]',
        '  /rx/self_test          [rx_msgs/action/SelfTest]',
      ].join('\n');
    }
    if (rest[0] === 'send_goal' && rest[1]) {
      return this._actionGoal(rest.slice(1));
    }
    return '用法: ros2 action list | send_goal <action> <type> <data>';
  },

  _ros2Param(rest) {
    if (rest[0] === 'list') {
      return [
        '节点参数 (/rx):',
        '  max_speed          100.0',
        '  max_accel          20.0',
        '  joint_limit_1      180.0',
        '  joint_limit_2      180.0',
        '  controller_mode    "position"',
        '  update_rate        200',
        '  imu_filter          "kalman"',
        '  camera_resolution  "1920x1080"',
        '  log_level           "INFO"',
      ].join('\n');
    }
    if (rest[0] === 'get' && rest[1] && rest[2]) {
      const params = { max_speed:'100.0', max_accel:'20.0', joint_limit_1:'180.0', joint_limit_2:'180.0', controller_mode:'position', update_rate:'200', imu_filter:'kalman', camera_resolution:'1920x1080', log_level:'INFO' };
      return params[rest[2]] !== undefined ? `参数 ${rest[1]}/${rest[2]} = ${params[rest[2]]}` : `参数 "${rest[2]}" 在节点 ${rest[1]} 上未找到`;
    }
    if (rest[0] === 'set' && rest[1] && rest[2] && rest[3] !== undefined) {
      const node = rest[1], key = rest[2], val = rest[3];
      addAlertLog(`参数更新: ${node}/${key} → ${val}`, 'text-cyber-cyan');
      flashElement('#sidebar');
      if (key === 'max_speed') document.getElementById('statCpu').textContent = Math.min(100, Math.round(parseFloat(val)/2)) + '%';
      return `Set parameter successful: ${key}=${val}  [节点: ${node}]`;
    }
    return '用法: ros2 param list | get <node> <key> | set <node> <key> <val>';
  },

  _ros2Launch(rest) {
    if (!rest[0] || !rest[1]) return '用法: ros2 launch <package> <launch_file>';
    flashElement('#sidebar');
    addAlertLog(`启动: ros2 launch ${rest[0]} ${rest[1]}`, 'text-cyber-green');
    return [
      `[INFO] [launch]: 启动包 ${rest[0]}...`,
      `[INFO] [launch]: 加载启动文件: ${rest[1]}`,
      `[INFO] [rx_controller-1]: 进程启动 [pid=12${Math.floor(Math.random()*9000)+1000}]`,
      `[INFO] [telemetry_bridge-2]: 进程启动 [pid=13${Math.floor(Math.random()*9000)+1000}]`,
      `[INFO] [launch]: 所有进程已启动 — 3/3 节点在线`,
    ].join('\n');
  },

  _ros2Run(rest) {
    if (!rest[0] || !rest[1]) return '用法: ros2 run <package> <executable>';
    flashElement('#chartTasks');
    addAlertLog(`运行节点: ros2 run ${rest[0]} ${rest[1]}`, 'text-cyber-cyan');
    return [
      `[INFO] [${rest[1]}]: 初始化节点...`,
      `[INFO] [${rest[1]}]: 加载参数... OK`,
      `[INFO] [${rest[1]}]: 创建发布/订阅... OK`,
      `[INFO] [${rest[1]}]: 节点 "${rest[1]}" 已启动 — PID ${Math.floor(Math.random()*9000)+14000}`,
    ].join('\n');
  },

  _ros2Bag(rest) {
    if (rest[0] === 'record') {
      const topics = rest.slice(1).join(' ') || '/rx/cmd_vel /rx/joint_states';
      addAlertLog(`开始录制: ${topics}`, 'text-cyber-amber');
      return `[INFO] [rosbag2]: 录制中...\n[INFO] [rosbag2]: 话题: ${topics}\n[INFO] [rosbag2]: 输出: rosbag2_${new Date().toISOString().slice(0,10).replace(/-/g,'')}/`;
    }
    if (rest[0] === 'play') return '[INFO] [rosbag2]: 回放完成 — 2341 条消息, 23.4s';
    if (rest[0] === 'info') return 'rosbag2_20260511/: 2341 条消息, 12 个话题, 23.4 秒, 14.2 MB';
    return '用法: ros2 bag record|play|info';
  },

  // --- ROS2 helper methods ---
  _topicEcho(topic) {
    const mockData = {
      '/rx/cmd_vel':    'linear:  {x: 1.0, y: 0.0, z: 0.0}\nangular: {x: 0.0, y: 0.0, z: 0.5}\n---',
      '/rx/joint_states':'position: [0.52, -1.21, 0.87, 0.0, 0.33, -0.15]\nvelocity: [0.01, -0.02, 0.0, 0.0, 0.01, 0.0]\n---',
      '/rx/imu':         'orientation: {x:0.0, y:0.0, z:0.02, w:1.0}\nangular_velocity: {x:0.01, y:0.0, z:0.0}\nlinear_accel: {x:0.05, y:0.0, z:-9.81}\n---',
      '/rx/laser':       'ranges: [1.2, 1.3, ∞, 2.1, 1.8, ...] (360 values)\nangle_min: -3.14, angle_max: 3.14\n---',
      '/rx/camera':      'width: 1920, height: 1080, encoding: rgb8\n---',
      '/rx/odom':        'pose: {x: 1.23, y: 0.45, theta: 0.78}\ntwist: {vx: 1.0, vy: 0.0, vtheta: 0.5}\n---',
      '/rx/temperature': `temperature: ${(55 + Math.random()*20).toFixed(1)}°C\nvariance: 0.01\n---`,
      '/rx/battery':     `voltage: ${(21 + Math.random()*3).toFixed(1)}V\npercentage: ${(65 + Math.random()*35).toFixed(0)}%\n---`,
      '/rx/emergency':   `data: false\n---`,
      '/rx/diagnostics': 'status: [{name:"joint_3", level:1, msg:"torque spike 4.2N·m"}, {name:"imu", level:0, msg:"OK"}]\n---',
    };
    return mockData[topic] || null;
  },

  _topicPub(args) {
    // args = [topic, type, ...data_parts]
    const topic = args[0];
    // const type = args[1];  // parsed but not displayed
    const data = args.slice(2).join(' ');

    if (topic === '/rx/emergency' || topic.includes('emergency')) {
      if (data.includes('true') || data.includes('True') || data.includes('1')) {
        updateAlertLevel('4');
        addAlertLog('EMERGENCY: 收到紧急停机指令', 'text-cyber-red');
        flashElement('#chartTasks');
        flashElement('#chartRadar');
        return `[PUB] ${topic}: 紧急停机已执行 — 所有动力切断`;
      }
      return `[PUB] ${topic}: data: false`;
    }

    if (topic === '/turtle1/cmd_vel') {
      var lx = data.match(/x:\s*([\d.-]+)/);
      var az = data.match(/z:\s*([\d.-]+)/);
      var vx = lx ? parseFloat(lx[1]) : 0;
      var va = az ? parseFloat(az[1]) : 0;
      if (bridgeConnected) bridgeCmdVel(vx, va);
      if (typeof T !== 'undefined' && T) T.cmdVel(vx, va);
      return '[PUB] /turtle1/cmd_vel: vx=' + vx.toFixed(1) + ', vz=' + va.toFixed(1);
    }

    if (topic === '/rx/cmd_vel') {
      // Parse Twist data roughly
      const lx = data.match(/x:\s*([\d.-]+)/);
      const az = data.match(/z:\s*([\d.-]+)/);
      const vx = lx ? parseFloat(lx[1]) : 0;
      const va = az ? parseFloat(az[1]) : 0;
      document.getElementById('statNet').textContent = `${(Math.abs(vx)*8 + Math.abs(va)*3).toFixed(1)} Mbps`;
      flashElement('#chartLoad');
      addAlertLog(`速度指令: vx=${vx.toFixed(1)} m/s, vz=${va.toFixed(1)} rad/s`, 'text-cyber-cyan');
      return `[PUB] ${topic}: 速度指令已发布 — linear.x=${vx.toFixed(1)}, angular.z=${va.toFixed(1)}`;
    }

    if (topic === '/rx/joint_states') {
      flashElement('#chartRadar');
      addAlertLog(`关节状态已发布`, 'text-gray-500');
      return `[PUB] ${topic}: 关节数据已发布`;
    }

    if (topic) {
      addAlertLog(`消息发布: ${topic}`, 'text-gray-500');
      return `[PUB] ${topic}: 消息已发布 — ${data || '无数据'}`;
    }
    return '用法: ros2 topic pub <topic> <type> <data>';
  },

  _serviceCall(args) {
    const srv = args[0];
    if (srv === '/rx/emergency_stop') {
      updateAlertLevel('4');
      Object.keys(nodeStates).forEach(n => { nodeStates[n] = false; });
      addAlertLog('服务调用: 紧急停机 — 全部节点离线', 'text-cyber-red');
      flashElement('#chartTasks');
      flashElement('#chartRadar');
      flashElement('#sidebar');
      return [
        '[service call] /rx/emergency_stop',
        '  response: {success: true, message: "Emergency stop executed. All motors halted."}',
      ].join('\n');
    }
    if (srv === '/rx/set_mode') {
      addAlertLog('服务调用: 模式切换', 'text-cyber-cyan');
      flashElement('#sidebar');
      return [
        '[service call] /rx/set_mode',
        '  request: {mode: "position"}',
        '  response: {success: true, current_mode: "position"}',
      ].join('\n');
    }
    if (srv === '/rx/calibrate') {
      addAlertLog('服务调用: 传感器校准 — 陀螺仪归零', 'text-cyber-cyan');
      flashElement('#chartRadar');
      return [
        '[service call] /rx/calibrate',
        '  calibrating IMU...',
        '  calibrating joints...',
        '  response: {success: true, message: "Calibration complete. 0 errors."}',
      ].join('\n');
    }
    if (srv === '/rx/reset_odom') {
      addAlertLog('服务调用: 里程计重置', 'text-gray-500');
      return '[service call] /rx/reset_odom\n  response: {success: true}';
    }
    if (srv === '/rx/enable_motor') {
      const enable = args[2] && args[2].includes('true');
      addAlertLog(`电机${enable?'启用':'禁用'}: ${srv}`, enable ? 'text-cyber-green' : 'text-cyber-amber');
      return `[service call] ${srv}\n  response: {success: true, motors_enabled: ${enable}}`;
    }
    return `[service call] ${srv}: 服务未识别 — 使用 ros2 service list 查看`;
  },

  _actionGoal(args) {
    const action = args[0];
    if (action === '/rx/self_test') {
      addAlertLog('启动自检序列...', 'text-cyber-cyan');
      const steps = ['[action] /rx/self_test 目标已接受', '  [1/4] IMU 测试... OK', '  [2/4] 关节测试... OK', '  [3/4] 通讯测试... OK', '  [4/4] 负载测试... OK'];
      if (window.__commands._selfTestTimer) { clearInterval(window.__commands._selfTestTimer); window.__commands._selfTestTimer = null; }
      // Simulate progress
      let i = 0;
      window.__commands._selfTestTimer = setInterval(() => {
        i++;
        if (i <= 4) appendOutput('result', steps[i]);
        if (i === 4) { clearInterval(window.__commands._selfTestTimer); window.__commands._selfTestTimer = null; appendOutput('result', '  结果: SUCCESS — 0 错误, 3 警告'); addAlertLog('自检完成: 0 错误', 'text-cyber-green'); flashElement('#chartRadar'); }
      }, 600);
      return steps[0];
    }
    if (action === '/rx/navigate_to_pose') {
      addAlertLog('导航目标已发送', 'text-cyber-cyan');
      return `[action] ${action} 目标已发送\n  目标: {x: 2.5, y: 1.0, theta: 0.78}\n  状态: ACCEPTED`;
    }
    if (action === '/rx/dock') {
      addAlertLog('对接程序启动', 'text-cyber-cyan');
      return `[action] ${action} 目标已接受\n  状态: EXECUTING\n  预计时间: 12s`;
    }
    return `[action] ${action}: 动作未识别 — 使用 ros2 action list 查看`;
  },
};

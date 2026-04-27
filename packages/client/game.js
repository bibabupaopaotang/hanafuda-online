// packages/client/game.js  
// 微信小游戏 - 完整版（含大厅、加入、开局）  
  
const canvas = wx.createCanvas();  
const ctx = canvas.getContext('2d');  
  
const CONFIG = {  
  SERVER_URL: 'ws://47.253.96.212/socket.io/?EIO=4&transport=websocket',  
};  
  
// 游戏状态  
const STATE = { MENU: 0, LOBBY: 1, GAME: 2 };  
let currentState = STATE.MENU;  
  
let statusText = '初始化中...';  
let myRoomId = '';  
let playerCount = 0; // 房间内人数  
  
// ================= 渲染逻辑 =================  
function render() {  
  ctx.clearRect(0, 0, canvas.width, canvas.height);  
    
  if (currentState === STATE.MENU) {  
    // 1. 主菜单  
    ctx.fillStyle = '#1a472a';  
    ctx.fillRect(0, 0, canvas.width, canvas.height);  
      
    ctx.fillStyle = '#ffffff';  
    ctx.font = 'bold 40px serif';  
    ctx.textAlign = 'center';  
    ctx.fillText('🌸 花札 Hanafuda 🌸', canvas.width / 2, 150);  
      
    // 创建房间按钮  
    ctx.fillStyle = '#4CAF50';  
    ctx.fillRect(canvas.width / 2 - 120, 250, 240, 70);  
    ctx.fillStyle = '#fff';  
    ctx.font = 'bold 28px sans-serif';  
    ctx.fillText('创建房间', canvas.width / 2, 300);  
      
    // 加入房间按钮  
    ctx.fillStyle = '#2196F3';  
    ctx.fillRect(canvas.width / 2 - 120, 350, 240, 70);  
    ctx.fillStyle = '#fff';  
    ctx.fillText('加入房间', canvas.width / 2, 400);  
      
    ctx.fillStyle = '#aaa';  
    ctx.font = '16px sans-serif';  
    ctx.fillText(`状态: ${statusText}`, canvas.width / 2, 500);  
      
  } else if (currentState === STATE.LOBBY) {  
    // 2. 房间大厅  
    ctx.fillStyle = '#1a472a';  
    ctx.fillRect(0, 0, canvas.width, canvas.height);  
      
    ctx.fillStyle = '#ffffff';  
    ctx.font = 'bold 30px serif';  
    ctx.textAlign = 'center';  
    ctx.fillText('🏠 房间大厅', canvas.width / 2, 120);  
      
    ctx.font = '24px sans-serif';  
    ctx.fillStyle = '#ffcc00';  
    ctx.fillText(`房间号: ${myRoomId}`, canvas.width / 2, 200);  
      
    ctx.fillStyle = '#ffffff';  
    ctx.fillText(`当前人数: ${playerCount} / 2`, canvas.width / 2, 260);  
      
    ctx.fillStyle = '#aaa';  
    ctx.font = '16px sans-serif';  
    ctx.fillText('等待对手加入...', canvas.width / 2, 320);  
  
    // 开始游戏按钮 (仅房主可见，这里简化为都可见)  
    ctx.fillStyle = playerCount >= 2 ? '#FF9800' : '#666';  
    ctx.fillRect(canvas.width / 2 - 120, 400, 240, 70);  
    ctx.fillStyle = '#fff';  
    ctx.font = 'bold 28px sans-serif';  
    ctx.fillText('开始游戏', canvas.width / 2, 450);  
      
  } else if (currentState === STATE.GAME) {  
    // 3. 游戏进行中  
    ctx.fillStyle = '#0b3d1e';  
    ctx.fillRect(0, 0, canvas.width, canvas.height);  
      
    ctx.fillStyle = '#ffffff';  
    ctx.font = 'bold 30px serif';  
    ctx.textAlign = 'center';  
    ctx.fillText('🃏 游戏进行中', canvas.width / 2, 100);  
      
    ctx.fillStyle = '#aaa';  
    ctx.font = '20px sans-serif';  
    ctx.fillText(statusText, canvas.width / 2, 150);  
      
    // 简单的牌桌示意  
    ctx.fillStyle = '#1a472a';  
    ctx.fillRect(50, 200, canvas.width - 100, 200);  
    ctx.strokeStyle = '#333';  
    ctx.strokeRect(50, 200, canvas.width - 100, 200);  
      
    ctx.fillStyle = '#fff';  
    ctx.fillText('场牌区 (0)', canvas.width / 2, 310);  
  }  
}  
  
render();  
  
// ================= 网络逻辑 =================  
connectServer();  
  
function connectServer() {  
  statusText = '连接服务器...';  
  render();  
  
  wx.connectSocket({  
    url: CONFIG.SERVER_URL,  
    fail: () => { statusText = '连接失败'; render(); }  
  });  
  
  wx.onSocketOpen(() => {  
    // 这里的逻辑放在 onMessage 里处理握手  
  });  
  
  wx.onSocketMessage((res) => {  
    let data = res.data;  
    if (data instanceof ArrayBuffer) {  
      data = String.fromCharCode.apply(null, new Uint8Array(data));  
    }  
    if (typeof data !== 'string') return;  
      
    const type = data.charAt(0);  
      
    // 1. 握手响应 (0) -> 发送 40 确认  
    if (type === '0') {  
      console.log('[Socket] 握手成功，回复 40');  
      wx.sendSocketMessage({ data: '40' });  
      if (currentState === STATE.MENU) statusText = '已连接';  
      render();  
      return;  
    }  
      
    // 2. Ping (2) -> 回复 Pong (3)  
    if (type === '2') {  
      wx.sendSocketMessage({ data: '3' });  
      return;  
    }  
      
    // 3. 消息 (4)  
    if (type === '4') {  
      const subType = data.charAt(1);  
      let content = data.substring(2);  
        
      // 忽略 40 确认  
      if (subType === '0') return;  
        
      // 处理事件 42 ["event", data]  
      if (subType === '2') {  
        try {  
          const arr = JSON.parse(content);  
          const event = arr[0];  
          const payload = arr[1];  
            
          handleEvent(event, payload);  
        } catch (e) {  
          console.error('[解析失败]', e);  
        }  
      }  
    }  
  });  
    
  wx.onSocketClose(() => {  
    statusText = '断开重连中...';  
    render();  
    setTimeout(connectServer, 3000);  
  });  
}  
  
// ================= 事件处理 =================  
function handleEvent(event, payload) {  
  console.log('[收到事件]', event, payload);  
    
  if (event === 'room_created') {  
    myRoomId = payload.room.id;  
    playerCount = payload.room.players.length;  
    currentState = STATE.LOBBY;  
    statusText = '房间已创建';  
    render();  
  }  
    
  else if (event === 'room_joined') {  
    myRoomId = payload.room.id;  
    playerCount = payload.room.players.length;  
    currentState = STATE.LOBBY;  
    statusText = '已加入房间';  
    render();  
  }  
    
  else if (event === 'player_joined') {  
    // 有人加入了，更新人数  
    if (payload.room) {  
      playerCount = payload.room.players.length;  
    }  
    statusText = '有玩家加入！';  
    render();  
  }  
    
  else if (event === 'game_start') {  
    // 游戏开始！  
    currentState = STATE.GAME;  
    statusText = '发牌中...';  
    console.log('>>> 游戏开始，状态:', payload.state);  
    render();  
  }  
    
  else if (event === 'error') {  
    statusText = '错误: ' + (payload.message || '未知');  
    render();  
  }  
}  
  
// ================= 交互逻辑 =================  
wx.onTouchStart((e) => {  
  const touch = e.touches[0];  
  const x = touch.clientX;  
  const y = touch.clientY;  
  const cx = canvas.width / 2;  
  
  if (currentState === STATE.MENU) {  
    // 创建房间  
    if (x > cx - 120 && x < cx + 120 && y > 250 && y < 320) {  
      statusText = '正在创建...';  
      render();  
      wx.sendSocketMessage({ data: '42["create_room"]' });  
    }  
      
    // 加入房间  
    if (x > cx - 120 && x < cx + 120 && y > 350 && y < 420) {  
      promptJoinRoom();  
    }  
  }  
    
  else if (currentState === STATE.LOBBY) {  
    // 开始游戏  
    if (x > cx - 120 && x < cx + 120 && y > 400 && y < 470) {  
      if (playerCount < 2) {  
        statusText = '人数不足，无法开始！';  
        render();  
      } else {  
        statusText = '请求开始游戏...';  
        render();  
        wx.sendSocketMessage({ data: '42["start_game"]' });  
      }  
    }  
  }  
});  
  
// 辅助：弹出输入框  
function promptJoinRoom() {  
  wx.showModal({  
    title: '加入房间',  
    content: '请输入房间号',  
    editable: true,  
    placeholderText: '6位数字',  
    success(res) {  
      if (res.confirm && res.content) {  
        statusText = `正在加入 ${res.content}...`;  
        render();  
        // 格式：42["join_room", "房间号"]  
        wx.sendSocketMessage({ data: `42["join_room","${res.content}"]` });  
      }  
    }  
  });  
}  

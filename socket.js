const SocketIO = require('socket.io');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cookie = require('cookie-signature');

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: '/socket.io' });
  app.set('io', io);
  const room = io.of('/room');
  const chat = io.of('/chat');

  // 요청을 보내면 누가 보냈는지 확인하는 방법이 세션쿠키로 확인하는건데 브라우저에서 서버로는 브라우저가 세션쿠키를 넣어서
  // 보내는데 서버에서 서버로 요청을 보낼 때는 세션쿠키를 안들어가 있어서 직접 넣어야 되기 때문에 밑에 cookieParser를
  // 세팅 한 이유. so that 세션쿠키를 axios에다가 넣어줄 수 있다. 58번째줄 처럼.

  io.use((socket, next) => {
    cookieParser(process.env.COOKIE_SECRET)(socket.request, socket.request.res || {}, next); // 미들웨어 확장한 것
    sessionMiddleware(socket.request, socket.request.res || {}, next);
  });

  room.on('connection', (socket) => {
    console.log('room 네임스페이스에 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    })
  });

  chat.on('connection', (socket) => {
    console.log('chat 네임스페이스에 접속');
    const req = socket.request;
    const { headers: { referer } } = req;
    console.log(referer);
    const roomId = referer
      .split('/')[referer.split('/').length - 1]
      .replace(/\?.+/, '');
    socket.join(roomId);
    socket.to(roomId).emit('join', {
      user: 'system',
      chat: `${req.session.color}님이 입장하셨습니다.`,
    });

    socket.on('disconnect', () => {
      console.log('chat 네임스페이스 접속 해제');
      socket.leave(roomId);
      const currentRoom = socket.adapter.rooms[roomId];
      const userCount = currentRoom ? currentRoom.length : 0;
      if (userCount === 0) { // 유저가 0명이면 방 삭제.
        const signedCookie = cookie.sign(req.signedCookies['connect.sid'], process.env.COOKIE_SECRET);  // 얘를 다시 서명을 해서 (1)
        const connectSID = `${signedCookie}`;
        axios.delete(`http://localhost:8005/room/${roomId}`, {
          headers: {
            Cookie: `connect.sid=s%3A${connectSID}` // s%3A는 s를 encodedURIComponent한거임. (꼭 이렇게 해야함)
          }
        })  // 헤더에 넣어줘야 한다. 그래야 delete 요청을 보낸 사람이 누구인지 서버가 알아서 찾을 수 있다. (2)
        .then(() => {
          console.log(`${roomId} 방 제거 성공`);
        })
        .catch((error) => {
          console.error(error);
        })
      } else {
        socket.to(roomId).emit('exit', {
          user: 'system',
          chat: `${req.session.color}님이 퇴장하셨습니다.`,
        });
      }
    });
  });
};

const express = require('express');

const Room = require('../schemas/room');
const Chat = require('../schemas/chat');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try{
        const rooms = await Room.find({});
        res.render('main', { rooms, title: 'GIF 채팅방' });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/room', (req, res) => {
    res.render('room', { title: 'GIF 채팅방 생성' });
});

router.post('/room', async (req, res, next) => {
    try {
        const newRoom = await Room.create({
            title: req.body.title,
            max: req.body.max,
            owner: req.session.color,
            password: req.body.password,
        });
        const io =req.app.get('io');
        io.of('/room').emit('newRoom', newRoom);
        res.redirect(`/room/${newRoom._id}?password=${req.body.password}`);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/room/:id', async (req, res, next) => {
    try {
        const room = await Room.findOne({ _id: req.params.id });
        const io = req.app.get('io');
        if (!room) {
            return res.redirect('/?error=존재하지 않는 방입니다.');
        }
        if (room.password && room.password !== req.query.password) {
            return res.redirect('/?error=비밀번호가 틀렸습니다.');
        }
        const { rooms } = io.of('/chat').adapter; // io.of('/chat').adapter.rooms 안에 방이 들어가있음 ex) io.of('/chat').adapter.rooms[방 아이디].length   <= 구조분해 할당
        if (rooms && rooms[req.params.id] && room.max <= rooms[req.params.id].length) {
            return res.redirect('/?error=허용 인원이 초과하였습니다.');
        }
        const chats = await Chat.find({ room: room._id }).sort('createdAt');
        return res.render('chat', {
            room,
            title: room.title,
            chats: [],
            user: req.session.color,
        });
    } catch (error) {
        console.error(error);
        return next(error);
    }
});

router.delete('/room/:id', async (req, res, next) => {
    try {
        await Room.remove({ _id: req.params.id });
        await Chat.remove({ room: req.params.id });
        res.send('ok');
        setTimeout(() => {
            req.app.get('io').of('/room').emit('removeRoom', req.params.id);
        }, 2000);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.post('/room/:id/chat', async (req, res, next) => {
    try {
        const chat = await Chat.create({
            room: req.params.id,
            user: req.session.console,
            chat: req.body.chat,
        });
        req.app.get('io').of('/chat').to(req.params.id).emit('chat', chat); // req.app.get('io').of('/chat').emit('chat', chat); 이렇게 하면 그 namespace 전체에게 보내진다.
        // .to(socket.id)는 귓속말 형식으로 메시지를 보낼 수 있음, 그리고 broadcast는 나를 제외한 나머지에게 메시지.
        res.send('ok');
    } catch(error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;
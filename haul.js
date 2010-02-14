function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype.vectorTo = function(destination, duration) {
    if (duration === undefined) {
        duration = 1;
    }
    return new Point(
            (destination.x - this.x) / duration,
            (destination.y - this.y) / duration);
};

function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

Rect.prototype.containsPoint = function(point) {
    return point.x >= this.x && point.x < this.x + this.width &&
        point.y >= this.y && point.y < this.y + this.height;
};

Rect.prototype.topLeft = function() {
    return new Point(this.x, this.y);
};

var GAME_AREA = new Rect(45, 205, 360, 360);
var COIN_SIZE = 45;
var CURSOR_OFFSET = 4;
var TICK_INTERVAL = Math.floor(1000 / 30); // 30 frames per second
var SWAP_DURATION = 0.3; // in seconds

function Layer() {
    this.gameObjects = [];
}

Layer.prototype.addGameObject = function(obj) {
    this.gameObjects.push(obj);
};

Layer.prototype.draw = function(ctx) {
    for (var i = 0; i < this.gameObjects.length; i++) {
        this.gameObjects[i].draw(ctx);
    }
};

Layer.prototype.hit = function(point) {
    for (var i = 0; i < this.gameObjects.length; i++) {
        var hitObj = this.gameObjects[i].hit(point);
        if (hitObj) {
            return hitObj;
        }
    }
    return null;
};

function Coin(pos, coinType) {
    this.rect = new Rect(pos.x, pos.y, COIN_SIZE, COIN_SIZE);
    this.coinType = coinType;
}

Coin.prototype.draw = function(ctx) {
    ctx.drawImage(this.coinType.image, 0, 0, COIN_SIZE, COIN_SIZE,
            Math.floor(this.rect.x), Math.floor(this.rect.y),
            COIN_SIZE, COIN_SIZE);
};

Coin.prototype.hit = function(point) {
    return this.rect.containsPoint(point) ? this : null;
};

Coin.prototype.swap = function(coin, completion) {
    var multi = multiCompletion(2, completion);
    tickMgr.addAnimation(
            new MoveAnimation(this, coin.rect.topLeft(), SWAP_DURATION),
            multi);
    tickMgr.addAnimation(
            new MoveAnimation(coin, this.rect.topLeft(), SWAP_DURATION),
            multi);
}

function TickManager(redraw) {
    this.animations = [];
    this.interval = null;
    this.redraw = redraw;
}

function multiCompletion(count, completion) {
    return function() {
        if (--count == 0) {
            completion();
        }
    };
}

TickManager.prototype.addAnimation = function(anim, completion) {
    if (completion === undefined) {
        completion = function() {};
    }
    this.animations.push({
        anim: anim,
        completion: completion
    });

    // Nothing to do if the interval timer has been started
    if (this.interval !== null) {
        return;
    }

    // Start interval timer
    var this_ = this;
    this.lastTick = new Date().getTime();
    this.interval = setInterval(function() {
            var now = new Date().getTime();
            var dt = (now - this_.lastTick) / 1000;
            this_.tick(dt);
            this_.lastTick = now;

            // Stop interval timer when there are no more animations
            if (this_.animations.length == 0) {
                clearInterval(this_.interval);
                this_.interval = null;
            }
        }, TICK_INTERVAL);
};

TickManager.prototype.tick = function(dt) {
    var deadAnimations = [];
    for (var i = 0; i < this.animations.length; i++) {
        if (!this.animations[i].anim.tick(dt)) {
            deadAnimations.push(i);
            this.animations[i].completion();
        }
    }

    while (deadAnimations.length > 0) {
        var i = deadAnimations.pop();
        this.animations.splice(i, 1);
    }

    this.redraw();
};

function MoveAnimation(obj, destination, duration) {
    this.obj = obj;
    this.destination = destination;
    this.duration = duration;
    this.direction = this.obj.rect.topLeft().vectorTo(destination, duration);
}

MoveAnimation.prototype.tick = function(dt) {
    this.obj.rect.x += this.direction.x * dt;
    this.obj.rect.y += this.direction.y * dt;

    this.duration -= dt;
    if (this.duration <= 0) {
        this.obj.rect.x = this.destination.x;
        this.obj.rect.y = this.destination.y;
        return false;
    }
    return true;
};

function CoinType(image) {
    this.image = image;
}

function Cursor(image, pos) {
    this.image = image;
    this.pos = pos;
    this.allowClick = false;
}

Cursor.prototype.draw = function(ctx) {
    ctx.drawImage(this.image, this.pos.x, this.pos.y);
};

Cursor.prototype.hit = function(point) {
    return null;
};

Cursor.prototype.onmousemove = function(point) {
    var newX = Math.floor((point.x - GAME_AREA.x) / COIN_SIZE) *
        COIN_SIZE + GAME_AREA.x - CURSOR_OFFSET;
    var newY = Math.floor((point.y - GAME_AREA.y) / COIN_SIZE) *
        COIN_SIZE + GAME_AREA.y - CURSOR_OFFSET;
    newY = Math.min(
            GAME_AREA.y + GAME_AREA.height - 2 * COIN_SIZE - CURSOR_OFFSET,
            newY);
    if (newX != this.pos.x || newY != this.pos.y) {
        this.pos.x = newX;
        this.pos.y = newY;
        return true;
    }
    return false;
};

Cursor.prototype.onclick = function(gameLayer) {
    if (!this.allowClick) {
        return;
    }

    var topCoin = gameLayer.hit(
            new Point(this.pos.x + COIN_SIZE, this.pos.y + COIN_SIZE));
    var bottomCoin = gameLayer.hit(
            new Point(this.pos.x + COIN_SIZE, this.pos.y + 2 * COIN_SIZE));
    this.allowClick = false;
    var this_ = this;
    topCoin.swap(bottomCoin, function() {
            this_.allowClick = true;
        });
};

function onload(e) {
    CoinType.silver = new CoinType(document.getElementById('silver'));
    CoinType.gold = new CoinType(document.getElementById('gold'));
    CoinType.bronze = new CoinType(document.getElementById('bronze'));
    CoinType.copper = new CoinType(document.getElementById('copper'));
    CoinType.ruby = new CoinType(document.getElementById('ruby'));
    CoinType.emerald = new CoinType(document.getElementById('emerald'));
    CoinType.coinTypes = [CoinType.silver, CoinType.gold,
        CoinType.bronze, CoinType.copper];

    var background = document.getElementById('background');

    var canvas = document.getElementById('game');
    var gameContext = canvas.getContext('2d');

    var backBuffer = document.getElementById('back-buffer');
    var context = backBuffer.getContext('2d');

    var gameLayer = new Layer();
    var overlay = new Layer();
    var cursor = new Cursor(document.getElementById('cursor'),
                new Point(GAME_AREA.x - CURSOR_OFFSET,
                    GAME_AREA.y - CURSOR_OFFSET));

    function redraw() {
        context.drawImage(background, 0, 0);

        context.save();
        context.rect(GAME_AREA.x, GAME_AREA.y,
                GAME_AREA.width, GAME_AREA.height);
        context.clip();
        gameLayer.draw(context);
        context.restore();

        overlay.draw(context);

        gameContext.drawImage(backBuffer, 0, 0);
    }

    tickMgr = new TickManager(redraw);

    document.addEventListener('mousemove',
            function(mouseEvent) {
                var point = new Point(
                    mouseEvent.pageX - canvas.offsetLeft,
                    mouseEvent.pageY - canvas.offsetTop);
                if (GAME_AREA.containsPoint(point)) {
                    if (cursor.onmousemove(point)) {
                        redraw();
                    }
                }
            }, false);

    document.addEventListener('click',
            function(mouseEvent) {
                var point = new Point(
                    mouseEvent.pageX - canvas.offsetLeft,
                    mouseEvent.pageY - canvas.offsetTop);
                if (GAME_AREA.containsPoint(point)) {
                    cursor.onclick(gameLayer);
                    redraw();
                }
            }, false);

    var multi = multiCompletion(8 * 8, function() {
            cursor.allowClick = true;
        });
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var coinType = CoinType.coinTypes[Math.floor(
                    Math.random() * CoinType.coinTypes.length)];
            var coin = new Coin(new Point(GAME_AREA.x + COIN_SIZE * i,
                        GAME_AREA.y + GAME_AREA.height + COIN_SIZE * j), coinType);
            gameLayer.addGameObject(coin);
            tickMgr.addAnimation(new MoveAnimation(coin,
                        new Point(coin.rect.x, coin.rect.y - GAME_AREA.height), 0.5),
                    multi);
        }
    }
    overlay.addGameObject(cursor);

    redraw();
}
document.addEventListener('load', onload, false);

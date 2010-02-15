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
var TICK_INTERVAL = Math.floor(1000 / 30); // in seconds
var SWAP_DURATION = 0.3; // in seconds
var FRAME_DURATION = 0.05; // in seconds
var SCROLL_DURATION = 0.05; // in seconds

function Layer() {
    this.gameObjects = [];
}

Layer.prototype.addGameObject = function(obj) {
    this.gameObjects.push(obj);
};

Layer.prototype.removeObject = function(obj) {
    var idx = this.gameObjects.indexOf(obj);
    if (idx !== -1) {
        this.gameObjects.splice(idx, 1);
    }
}

Layer.prototype.removeObjects = function(objs) {
    for (var i = 0; i < objs.length; i++) {
        this.removeObject(objs[i]);
    }
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
    this.frame = 0;
}

Coin.prototype.draw = function(ctx) {
    ctx.drawImage(this.coinType.image,
            this.frame * COIN_SIZE, 0, COIN_SIZE, COIN_SIZE,
            Math.floor(this.rect.x), Math.floor(this.rect.y),
            COIN_SIZE, COIN_SIZE);
};

Coin.prototype.hit = function(point) {
    return this.rect.containsPoint(point) ? this : null;
};

Coin.prototype.isSameType = function(coin) {
    return this.coinType.image === coin.coinType.image;
}

Coin.prototype.swap = function(coin, completion) {
    var multi = multiCompletion(2, completion);
    tickMgr.addAnimation(
            new MoveAnimation(this, coin.rect.topLeft(), SWAP_DURATION),
            multi);
    tickMgr.addAnimation(
            new MoveAnimation(coin, this.rect.topLeft(), SWAP_DURATION),
            multi);
}

function scrollInNewCoin(gameLayer, i, j, completion) {
    var coinType = CoinType.coinTypes[Math.floor(
            Math.random() * CoinType.coinTypes.length)];
    var coin = new Coin(new Point(GAME_AREA.x + COIN_SIZE * i,
                GAME_AREA.y + GAME_AREA.height + COIN_SIZE * j), coinType);
    gameLayer.addGameObject(coin);
    tickMgr.addAnimation(new MoveAnimation(coin,
                new Point(coin.rect.x, coin.rect.y - GAME_AREA.height), 8 * SCROLL_DURATION),
            completion);
}

function multiCompletion(count, completion) {
    if (completion === undefined) {
        completion = function() {};
    }
    return function() {
        if (--count === 0) {
            completion();
        }
    };
}

function TickManager(redraw) {
    this.animations = [];
    this.interval = null;
    this.redraw = redraw;
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
            if (this_.animations.length === 0) {
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

function FrameAnimation(obj, duration) {
    this.obj = obj;
    this.duration = duration;
    this.accum = 0;
}

FrameAnimation.prototype.tick = function(dt) {
    this.accum += dt;
    while (this.accum > FRAME_DURATION) {
        this.obj.frame = (this.obj.frame + 1) % this.obj.coinType.nFrames;
        this.accum -= FRAME_DURATION;
    }

    this.duration -= dt;
    if (this.duration <= 0) {
        this.obj.frame = 0;
        return false;
    }
    return true;
};

function CoinType(image) {
    this.image = image;
    this.nFrames = image.width / COIN_SIZE;
}

function findClears(gameLayer) {
    function concatToSet(set, newElems) {
        for (var i = 0; i < newElems.length; i++) {
            if (set.indexOf(newElems[i]) === -1) {
                set.push(newElems[i]);
            }
        }
    }

    function findSameCoins(coin, direction) {
        var nextCoin;
        var coins = [];
        var point = coin.rect.topLeft();
        for (var i = 0; i < 8; i++) {
            nextCoin = gameLayer.hit(point);
            if (nextCoin === null || !nextCoin.isSameType(coin)) {
                break;
            }
            coins.push(nextCoin);
            point.x += COIN_SIZE * direction.x;
            point.y += COIN_SIZE * direction.y;
        }
        return coins;
    }

    var horizontal = new Point(1, 0);
    var vertical = new Point(0, 1);
    var clearedCoins = [];
    for (var y = 0; y < 8; y++) {
        for (var x = 0; x < 8; x++) {
            var coin = gameLayer.hit(new Point(GAME_AREA.x + COIN_SIZE * x, GAME_AREA.y + COIN_SIZE * y));
            var hSameCoins = findSameCoins(coin, horizontal);
            var vSameCoins = findSameCoins(coin, vertical);
            if (hSameCoins.length >= 3) {
                concatToSet(clearedCoins, hSameCoins);
            }
            if (vSameCoins.length >= 3) {
                concatToSet(clearedCoins, vSameCoins);
            }
        }
    }
    return clearedCoins;
}

function spinCoins(coins, completion) {
    var multi = multiCompletion(coins.length, completion);
    for (var i = 0; i < coins.length; i++) {
        tickMgr.addAnimation(new FrameAnimation(coins[i], FRAME_DURATION * 7), multi);
    }
}

function applyGravity(gameLayer, completion) {
    function doColumn(x, moveUpFunc) {
        var nHoles = 0;
        var point = new Point(
                GAME_AREA.x + x * COIN_SIZE, GAME_AREA.y);
        for (; point.y < GAME_AREA.y + 8 * COIN_SIZE;
                point.y += COIN_SIZE) {
            var coin = gameLayer.hit(point);
            if (coin === null) {
                nHoles++;
            } else {
                if (nHoles > 0) {
                    moveUpFunc(coin, nHoles);
                }
            }
        }
        return nHoles;
    }

    function doColumns(moveUpFunc, columnFunc) {
        for (var x = 0; x < 8; x++) {
            var nHoles = doColumn(x, moveUpFunc);
            columnFunc(x, nHoles);
        }
    }

    // Count how many coins will move
    var nMovedCoins = 0;
    var nNewCoins = 0;
    doColumns(function() {
        nMovedCoins++;
    }, function(x, nHoles) {
        nNewCoins += nHoles;
    });

    // Move coins
    var multi = multiCompletion(nMovedCoins + nNewCoins, function() {
        // Check for new clears that have been created
        detectClears(gameLayer, completion);
    });
    doColumns(function(coin, nHoles) {
        var destination = new Point(coin.rect.x,
            coin.rect.y - nHoles * COIN_SIZE);
        tickMgr.addAnimation(new MoveAnimation(
                coin, destination, nHoles * SCROLL_DURATION), multi);
    }, function(x, nHoles) {
        for (var y = 8 - nHoles; y < 8; y++) {
            scrollInNewCoin(gameLayer, x, y, multi);
        }
    });
}

function detectClears(gameLayer, completion) {
    var clears = findClears(gameLayer);
    if (clears.length === 0) {
        completion();
    }

    function spinComplete() {
        gameLayer.removeObjects(clears);
        applyGravity(gameLayer, completion);
    }
    spinCoins(clears, spinComplete);
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
            detectClears(gameLayer, function() {
                this_.allowClick = true;
            });
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
            detectClears(gameLayer, function() {
                cursor.allowClick = true;
            });
        });
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            scrollInNewCoin(gameLayer, i, j, multi);
        }
    }
    overlay.addGameObject(cursor);

    redraw();
}
document.addEventListener('load', onload, false);

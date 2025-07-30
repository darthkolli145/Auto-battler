// Enhanced Game State with Large Arena
class Game {
    constructor() {
        this.round = 1;
        this.gold = 10;
        this.health = 100;
        this.phase = 'preparation';
        
        // Arena is 6x8 grid (6 columns, 8 rows) - vertical orientation
        this.arenaWidth = 6;
        this.arenaHeight = 8;
        this.arena = Array(this.arenaHeight).fill().map(() => Array(this.arenaWidth).fill(null));
        
        this.playerBench = new Array(8).fill(null);
        this.shop = [];
        this.battleLog = [];
        this.draggedUnit = null;
        this.dragSource = null;
        this.playerUnitsInBattle = []; // Track all player units that entered battle
        
        this.initializeArena();
        this.initializeShop();
        this.generateEnemyTeam();
        this.bindEvents();
        this.bindShopSellEvents();
        this.updateUI();
    }
    
    initializeArena() {
        const arenaGrid = document.getElementById('arena-grid');
        arenaGrid.innerHTML = '';
        
        // Create arena slots
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const slot = document.createElement('div');
                slot.className = 'arena-slot';
                slot.dataset.row = row;
                slot.dataset.col = col;
                
                // Mark player zone (bottom 3 rows) and enemy zone (top 3 rows)
                if (row >= 5) {
                    slot.classList.add('player-zone');
                } else if (row < 3) {
                    slot.classList.add('enemy-zone');
                }
                
                // Add drag and drop listeners
                slot.addEventListener('dragover', (e) => this.handleArenaSlotDragOver(e));
                slot.addEventListener('drop', (e) => this.handleArenaSlotDrop(e, row, col));
                slot.addEventListener('click', () => this.handleArenaSlotClick(row, col));
                
                arenaGrid.appendChild(slot);
            }
        }
    }
    
    initializeShop() {
        this.shop = [];
        for (let i = 0; i < 5; i++) {
            this.shop.push(this.generateRandomUnit());
        }
        this.renderShop();
    }
    
    generateRandomUnit() {
        const unitTypes = [
            { type: 'knight', cost: 3 },
            { type: 'archer', cost: 2 },
            { type: 'mage', cost: 4 },
            { type: 'tank', cost: 5 },
            { type: 'assassin', cost: 3 }
        ];
        
        const randomType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
        return new Unit(randomType.type, randomType.cost);
    }
    
    generateEnemyTeam() {
        // Clear existing enemies
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                this.arena[row][col] = null;
            }
        }
        
        const enemyCount = Math.min(2 + Math.floor(this.round / 2), 12);
        
        // Place enemies in their zone (top rows)
        const enemyPositions = [
            {row: 1, col: 2}, {row: 1, col: 3}, {row: 0, col: 1}, {row: 0, col: 4},
            {row: 2, col: 0}, {row: 2, col: 5}, {row: 0, col: 2}, {row: 0, col: 3},
            {row: 1, col: 0}, {row: 1, col: 5}, {row: 2, col: 2}, {row: 2, col: 3}
        ];
        
        for (let i = 0; i < enemyCount; i++) {
            const unit = this.generateRandomUnit();
            unit.isEnemy = true;
            // Scale enemy stats based on round
            unit.attack = Math.floor(unit.attack * (1 + this.round * 0.1));
            unit.health = Math.floor(unit.health * (1 + this.round * 0.1));
            unit.maxHealth = unit.health;
            
            const pos = enemyPositions[i];
            this.arena[pos.row][pos.col] = unit;
        }
        
        this.renderArena();
    }
    
    buyUnit(shopIndex) {
        const unit = this.shop[shopIndex];
        if (!unit || unit.sold || this.gold < unit.cost) {
            return false;
        }
        
        // Try to find empty slot in bench first
        const emptyBenchSlot = this.playerBench.findIndex(slot => slot === null);
        if (emptyBenchSlot === -1) {
            this.addToLog('Bench is full!');
            return false;
        }
        
        // Purchase unit
        this.gold -= unit.cost;
        this.playerBench[emptyBenchSlot] = unit;
        unit.sold = true;
        
        this.addToLog(`Purchased ${unit.type} for ${unit.cost} gold`);
        this.checkForCombinableUnits();
        this.updateUI();
        this.renderBench();
        this.renderShop();
        
        return true;
    }
    
    autoCombineUnits(unitGroup) {
        while (unitGroup.length >= 3) {
            // Take the first 3 units of the same type and tier
            const unitsToCombine = unitGroup.splice(0, 3);
            const baseUnit = unitsToCombine[0];
            
            // Create upgraded unit
            const upgradedUnit = new Unit(baseUnit.type, 0);
            upgradedUnit.tier = baseUnit.tier + 1;
            upgradedUnit.upgradeStats();
            
            // Remove the 3 units from their current locations
            unitsToCombine.forEach(unit => this.removeUnitFromAllLocations(unit));
            
                         // Place the upgraded unit in the first available bench slot
             const emptyBenchSlot = this.playerBench.findIndex(slot => slot === null);
             if (emptyBenchSlot !== -1) {
                 this.playerBench[emptyBenchSlot] = upgradedUnit;
             }
             
             this.addToLog(`Combined 3 ${baseUnit.type}s into a Tier ${upgradedUnit.tier} ${upgradedUnit.type}!`, 'victory');
             
             // Re-render after combining
             this.renderBench();
             this.renderArena();
        }
    }
    
    checkForCombinableUnits() {
        // Clear previous combinable state
        [...this.playerBench].forEach(unit => {
            if (unit) unit.combinable = false;
        });
        
        // Also check arena for player units
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const unit = this.arena[row][col];
                if (unit && !unit.isEnemy) {
                    unit.combinable = false;
                }
            }
        }
        
        // Group units by type and tier
        const unitGroups = {};
        const allPlayerUnits = [...this.playerBench];
        
        // Add arena units
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const unit = this.arena[row][col];
                if (unit && !unit.isEnemy) {
                    allPlayerUnits.push(unit);
                }
            }
        }
        
        allPlayerUnits.forEach(unit => {
            if (unit) {
                const key = `${unit.type}_${unit.tier}`;
                if (!unitGroups[key]) unitGroups[key] = [];
                unitGroups[key].push(unit);
            }
        });
        
        // Mark units that can be combined (3 of same type and tier)
        Object.values(unitGroups).forEach(group => {
            if (group.length >= 3) {
                group.forEach(unit => unit.combinable = true);
                // Auto-combine when we have 3 or more
                this.autoCombineUnits(group);
            }
        });
    }
    
    moveUnitToArena(unit, row, col) {
        // Remove unit from current location
        this.removeUnitFromAllLocations(unit);
        
        // Place in arena
        this.arena[row][col] = unit;
        
        // Check for combinations after moving unit
        this.checkForCombinableUnits();
        this.updateUI();
        this.renderArena();
        this.renderBench();
    }
    
    removeUnitFromAllLocations(unit) {
        // Remove from bench
        const benchIndex = this.playerBench.indexOf(unit);
        if (benchIndex !== -1) {
            this.playerBench[benchIndex] = null;
        }
        
        // Remove from arena
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                if (this.arena[row][col] === unit) {
                    this.arena[row][col] = null;
                }
            }
        }
    }
    
    refreshShop() {
        if (this.gold < 2) {
            this.addToLog('Not enough gold to refresh shop!');
            return;
        }
        
        this.gold -= 2;
        this.initializeShop();
        this.updateUI();
        this.addToLog('Shop refreshed!');
    }
    
    startBattle() {
        // Check if player has any units on the field
        let hasUnits = false;
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const unit = this.arena[row][col];
                if (unit && !unit.isEnemy) {
                    hasUnits = true;
                    break;
                }
            }
        }
        
        if (!hasUnits) {
            this.addToLog('You need to deploy at least one unit to battle!');
            return;
        }
        
        this.phase = 'battle';
        this.updateUI();
        this.addToLog('Battle begins!');
        
        // Track all player units that entered this battle
        this.playerUnitsInBattle = [];
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const unit = this.arena[row][col];
                if (unit) {
                    if (!unit.isEnemy) {
                        this.playerUnitsInBattle.push(unit);
                    }
                    unit.health = unit.maxHealth;
                    unit.abilityCooldown = 0;
                    unit.hasMoved = false;
                }
            }
        }
        
        this.executeBattle();
    }
    
    async executeBattle() {
        let turn = 0;
        const maxTurns = 100;
        
        while (turn < maxTurns) {
            const playerUnits = this.getAllPlayerUnits();
            const enemyUnits = this.getAllEnemyUnits();
            
            if (playerUnits.length === 0) {
                this.endBattle(false);
                return;
            }
            
            if (enemyUnits.length === 0) {
                this.endBattle(true);
                return;
            }
            
            // Movement phase - units move to get into range
            await this.processMovePhase(playerUnits, enemyUnits);
            await this.delay(500);
            
            // Combat phase - units attack
            await this.processCombatPhase(playerUnits, enemyUnits);
            await this.delay(300);
            
            turn++;
        }
        
        this.endBattle(false);
    }
    
    async processMovePhase(playerUnits, enemyUnits) {
        this.addToLog('Movement phase...', 'phase');
        
        // Player units move first
        for (let unit of playerUnits) {
            if (unit.health > 0) {
                await this.moveUnitIntelligently(unit, enemyUnits);
                await this.delay(200);
            }
        }
        
        // Enemy units move
        for (let unit of enemyUnits) {
            if (unit.health > 0) {
                await this.moveUnitIntelligently(unit, playerUnits);
                await this.delay(200);
            }
        }
        
        this.renderArena();
    }
    
    async processCombatPhase(playerUnits, enemyUnits) {
        this.addToLog('Combat phase...', 'phase');
        
        // All units attack in speed order
        const allUnits = [...playerUnits, ...enemyUnits]
            .filter(unit => unit.health > 0)
            .sort((a, b) => b.speed - a.speed);
        
        for (let unit of allUnits) {
            if (unit.health > 0) {
                const targets = unit.isEnemy ? playerUnits : enemyUnits;
                await this.unitAction(unit, targets);
                await this.delay(400);
            }
        }
    }
    
    async moveUnitIntelligently(unit, enemyUnits) {
        const currentPos = this.getUnitPosition(unit);
        if (!currentPos) return;
        
        // Find closest enemy within range
        let bestTarget = null;
        let closestDistance = Infinity;
        
        for (let enemy of enemyUnits) {
            if (enemy.health <= 0) continue;
            
            const enemyPos = this.getUnitPosition(enemy);
            if (!enemyPos) continue;
            
            const distance = this.calculateDistance(currentPos, enemyPos);
            if (distance <= unit.range) {
                // Already in range, no need to move
                return;
            }
            
            if (distance < closestDistance) {
                closestDistance = distance;
                bestTarget = enemy;
            }
        }
        
        if (!bestTarget) return;
        
        // Find best position to move to get in range of target
        const targetPos = this.getUnitPosition(bestTarget);
        const bestMovePos = this.findBestMovePosition(currentPos, targetPos, unit);
        
        if (bestMovePos && !this.positionsEqual(currentPos, bestMovePos)) {
            // Move unit
            this.arena[currentPos.row][currentPos.col] = null;
            this.arena[bestMovePos.row][bestMovePos.col] = unit;
            
            // Visual feedback
            this.highlightMovement(currentPos, bestMovePos);
            await this.delay(300);
            this.clearMovementHighlights();
            
            this.addToLog(`${unit.type} moves to position (${bestMovePos.row}, ${bestMovePos.col})`, 'movement');
        }
    }
    
    findBestMovePosition(fromPos, targetPos, unit) {
        const possibleMoves = this.getPossibleMoves(fromPos, unit.speed);
        let bestPos = null;
        let bestScore = Infinity;
        
        for (let pos of possibleMoves) {
            if (this.arena[pos.row][pos.col] !== null) continue; // Occupied
            
            const distance = this.calculateDistance(pos, targetPos);
            if (distance <= unit.range && distance < bestScore) {
                bestScore = distance;
                bestPos = pos;
            }
        }
        
        // If no position gets us in range, move closer
        if (!bestPos) {
            for (let pos of possibleMoves) {
                if (this.arena[pos.row][pos.col] !== null) continue;
                
                const distance = this.calculateDistance(pos, targetPos);
                if (distance < bestScore) {
                    bestScore = distance;
                    bestPos = pos;
                }
            }
        }
        
        return bestPos;
    }
    
    getPossibleMoves(fromPos, moveRange) {
        const moves = [];
        
        for (let dr = -moveRange; dr <= moveRange; dr++) {
            for (let dc = -moveRange; dc <= moveRange; dc++) {
                if (Math.abs(dr) + Math.abs(dc) > moveRange) continue;
                if (dr === 0 && dc === 0) continue; // Current position
                
                const newRow = fromPos.row + dr;
                const newCol = fromPos.col + dc;
                
                if (newRow >= 0 && newRow < this.arenaHeight && 
                    newCol >= 0 && newCol < this.arenaWidth) {
                    moves.push({row: newRow, col: newCol});
                }
            }
        }
        
        return moves;
    }
    
    highlightMovement(fromPos, toPos) {
        const fromSlot = document.querySelector(`[data-row="${fromPos.row}"][data-col="${fromPos.col}"]`);
        const toSlot = document.querySelector(`[data-row="${toPos.row}"][data-col="${toPos.col}"]`);
        
        if (fromSlot) fromSlot.classList.add('movement-path');
        if (toSlot) toSlot.classList.add('move-target');
    }
    
    clearMovementHighlights() {
        document.querySelectorAll('.movement-path, .move-target').forEach(slot => {
            slot.classList.remove('movement-path', 'move-target');
        });
    }
    
    async unitAction(unit, targetUnits) {
        const unitPos = this.getUnitPosition(unit);
        if (!unitPos) return;
        
        // Reduce ability cooldown
        if (unit.abilityCooldown > 0) {
            unit.abilityCooldown--;
        }
        
        // Try to use special ability
        if (unit.abilityCooldown === 0 && Math.random() < 0.3) {
            await this.useSpecialAbility(unit, targetUnits);
            unit.abilityCooldown = unit.abilityCooldownMax;
            return;
        }
        
        // Regular attack
        await this.unitAttack(unit, targetUnits);
    }
    
    async useSpecialAbility(unit, targetUnits) {
        const ability = unit.getSpecialAbility();
        this.addToLog(`${unit.type} uses ${ability.name}!`, 'ability');
        
        await ability.execute(unit, targetUnits, this);
    }
    
    async unitAttack(unit, targetUnits) {
        const targets = this.getTargetsInRange(unit, targetUnits);
        if (targets.length === 0) return;
        
        const target = targets[Math.floor(Math.random() * targets.length)];
        const damage = Math.max(1, unit.attack + Math.floor(Math.random() * 3) - 1);
        
        target.health = Math.max(0, target.health - damage);
        
        this.addToLog(`${unit.type} attacks ${target.type} for ${damage} damage`, 'damage');
        
        if (target.health <= 0) {
            this.addToLog(`${target.type} has been defeated!`, 'defeat');
            // Remove from arena
            const targetPos = this.getUnitPosition(target);
            if (targetPos) {
                this.arena[targetPos.row][targetPos.col] = null;
            }
        }
        
        this.renderArena();
    }
    
    getTargetsInRange(unit, targetUnits) {
        const unitPos = this.getUnitPosition(unit);
        if (!unitPos) return [];
        
        return targetUnits.filter(target => {
            if (target.health <= 0) return false;
            
            const targetPos = this.getUnitPosition(target);
            if (!targetPos) return false;
            
            const distance = this.calculateDistance(unitPos, targetPos);
            return distance <= unit.range;
        });
    }
    
    getAllPlayerUnits() {
        const units = [];
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const unit = this.arena[row][col];
                if (unit && !unit.isEnemy && unit.health > 0) {
                    units.push(unit);
                }
            }
        }
        return units;
    }
    
    getAllEnemyUnits() {
        const units = [];
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                const unit = this.arena[row][col];
                if (unit && unit.isEnemy && unit.health > 0) {
                    units.push(unit);
                }
            }
        }
        return units;
    }
    
    getUnitPosition(unit) {
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                if (this.arena[row][col] === unit) {
                    return {row, col};
                }
            }
        }
        return null;
    }
    
    calculateDistance(pos1, pos2) {
        return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
    }
    
    positionsEqual(pos1, pos2) {
        return pos1.row === pos2.row && pos1.col === pos2.col;
    }
    
    endBattle(playerWon) {
        this.phase = 'results';
        
        if (playerWon) {
            const goldReward = 2 + Math.floor(this.round / 2);
            this.gold += goldReward;
            this.addToLog(`Victory! You earned ${goldReward} gold.`, 'victory');
        } else {
            const healthLoss = 10 + Math.floor(this.round / 2);
            this.health = Math.max(0, this.health - healthLoss);
            this.addToLog(`Defeat! You lost ${healthLoss} health.`, 'defeat');
            
            if (this.health <= 0) {
                this.addToLog('Game Over! You have been eliminated.', 'defeat');
                this.updateUI();
                return;
            }
        }
        
        this.updateUI();
        
        // Show next round button
        document.getElementById('next-round').style.display = 'inline-block';
        document.getElementById('start-battle').style.display = 'none';
    }
    
    nextRound() {
        this.round++;
        this.phase = 'preparation';
        this.gold += 1;
        
        // Use the tracked player units from the battle (includes those that died)
        const playerUnits = this.playerUnitsInBattle || [];
        
        // Reset their health and status (resurrect dead units)
        playerUnits.forEach(unit => {
            unit.health = unit.maxHealth;
            unit.abilityCooldown = 0;
            unit.hasMoved = false;
        });
        
        // Clear the entire arena
        for (let row = 0; row < this.arenaHeight; row++) {
            for (let col = 0; col < this.arenaWidth; col++) {
                this.arena[row][col] = null;
            }
        }
        
        // Move all player units back to bench for repositioning
        playerUnits.forEach((unit, index) => {
            const emptyBenchSlot = this.playerBench.findIndex(slot => slot === null);
            if (emptyBenchSlot !== -1) {
                this.playerBench[emptyBenchSlot] = unit;
            }
        });
        
        // Check for combinations after units return to bench
        this.checkForCombinableUnits();
        
        this.generateEnemyTeam();
        this.initializeShop();
        if (playerUnits.length > 0) {
            this.addToLog(`Round ${this.round} begins! ${playerUnits.length} units have been healed and can be repositioned.`);
        } else {
            this.addToLog(`Round ${this.round} begins! Deploy units from your bench to fight.`);
        }
        
        document.getElementById('next-round').style.display = 'none';
        document.getElementById('start-battle').style.display = 'inline-block';
        
        this.updateUI();
        this.renderArena();
        this.renderBench();
    }
    
    addToLog(message, type = '') {
        const logContent = document.getElementById('log-content');
        const p = document.createElement('p');
        p.textContent = message;
        if (type) {
            p.classList.add(type);
        }
        logContent.appendChild(p);
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    renderArena() {
        const slots = document.querySelectorAll('.arena-slot');
        
        slots.forEach(slot => {
            const row = parseInt(slot.dataset.row);
            const col = parseInt(slot.dataset.col);
            const unit = this.arena[row][col];
            
            slot.innerHTML = '';
            slot.classList.remove('occupied');
            
            if (unit) {
                slot.classList.add('occupied');
                const unitElement = this.createUnitElement(unit, 'arena');
                slot.appendChild(unitElement);
            }
        });
    }
    
    renderBench() {
        const slots = document.querySelectorAll('.bench-slot');
        
        slots.forEach((slot, index) => {
            slot.innerHTML = '';
            slot.classList.remove('occupied');
            
            const unit = this.playerBench[index];
            if (unit) {
                slot.classList.add('occupied');
                const unitElement = this.createUnitElement(unit, 'small');
                slot.appendChild(unitElement);
            }
        });
    }
    
    createUnitElement(unit, size = 'normal') {
        const unitElement = document.createElement('div');
        const sizeClass = size === 'small' ? 'unit-small' : (size === 'arena' ? 'unit-arena' : 'unit');
        unitElement.className = `${sizeClass} ${unit.type} tier-${unit.tier}`;
        if (unit.combinable) unitElement.classList.add('combinable');
        if (unit.abilityCooldown === 0) unitElement.classList.add('ability-ready');
        if (unit.isEnemy) unitElement.classList.add('enemy-unit');
        
        unitElement.setAttribute('data-unit-id', unit.id);
        unitElement.setAttribute('data-type', unit.type);
        // Make all player units draggable, including those on the arena
        if (size !== 'arena' || !unit.isEnemy) {
            unitElement.draggable = true;
        }
        
        unitElement.innerHTML = `
            <div class="unit-level">T${unit.tier}</div>
            <div class="unit-range">R${unit.range}</div>
            <span>${unit.type.charAt(0).toUpperCase()}</span>
            <div class="unit-stats">${unit.health}/${unit.maxHealth}</div>
            ${unit.abilityCooldown > 0 ? `<div class="ability-cooldown">${unit.abilityCooldown}</div>` : ''}
        `;
        
        // Add drag event listeners for player units (including those on arena)
        if (size !== 'arena' || !unit.isEnemy) {
            unitElement.addEventListener('dragstart', (e) => this.handleDragStart(e, unit));
            unitElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
        }
        
        return unitElement;
    }
    
    renderShop() {
        const shopContainer = document.getElementById('shop-units');
        shopContainer.innerHTML = '';
        
        this.shop.forEach((unit, index) => {
            const unitElement = document.createElement('div');
            unitElement.className = `shop-unit ${unit.type} ${unit.sold ? 'sold' : ''}`;
            unitElement.innerHTML = `
                <div class="unit-name">${unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}</div>
                <div class="unit-stats-display">
                    ATK: ${unit.attack} | HP: ${unit.health}<br>
                    Range: ${unit.range} | Move: ${unit.speed}<br>
                    Ability: ${unit.getSpecialAbility().name}
                </div>
                <div class="unit-cost">${unit.cost} Gold</div>
            `;
            
            if (!unit.sold) {
                unitElement.addEventListener('click', () => this.buyUnit(index));
            }
            
            shopContainer.appendChild(unitElement);
        });
    }
    
    handleDragStart(e, unit) {
        this.draggedUnit = unit;
        e.target.classList.add('dragging');
        
        // Determine drag source
        if (this.playerBench.includes(unit)) {
            this.dragSource = { type: 'bench', index: this.playerBench.indexOf(unit) };
        } else {
            // Check if unit is on the arena
            for (let row = 0; row < this.arenaHeight; row++) {
                for (let col = 0; col < this.arenaWidth; col++) {
                    if (this.arena[row][col] === unit) {
                        this.dragSource = { type: 'arena', row: row, col: col };
                        return;
                    }
                }
            }
        }
    }
    
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        this.draggedUnit = null;
        this.dragSource = null;
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.target.closest('.bench-slot').classList.add('drag-over');
    }
    
    handleArenaSlotDragOver(e) {
        e.preventDefault();
        e.target.classList.add('drag-over');
    }
    
    handleArenaSlotDrop(e, row, col) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        if (!this.draggedUnit || this.phase !== 'preparation') return;
        
        // Check if it's an enemy unit (shouldn't be draggable, but just in case)
        if (this.draggedUnit.isEnemy) {
            this.addToLog('Cannot move enemy units!');
            return;
        }
        
        // Check if slot is in player zone for new deployments
        if (this.dragSource.type === 'bench' && row < 5) {
            this.addToLog('You can only deploy units in your zone (bottom rows)!');
            return;
        }
        
        // Handle repositioning within arena
        const targetUnit = this.arena[row][col];
        
        if (targetUnit && targetUnit !== this.draggedUnit) {
            // Swap positions if both are player units
            if (!targetUnit.isEnemy && this.dragSource.type === 'arena') {
                this.arena[this.dragSource.row][this.dragSource.col] = targetUnit;
                this.arena[row][col] = this.draggedUnit;
                this.addToLog(`Swapped ${this.draggedUnit.type} and ${targetUnit.type} positions`);
                this.renderArena();
                this.renderBench();
            } else {
                this.addToLog('That position is already occupied!');
                return;
            }
        } else {
            // Move to empty slot
            this.moveUnitToArena(this.draggedUnit, row, col);
        }
        
        // Check for combinations after any unit movement
        this.checkForCombinableUnits();
    }
    
    handleArenaSlotClick(row, col) {
        // For debugging/info purposes
        const unit = this.arena[row][col];
        if (unit) {
            this.addToLog(`Unit: ${unit.type}, Health: ${unit.health}/${unit.maxHealth}, Position: (${row}, ${col})`);
        }
    }
    
    updateUI() {
        document.getElementById('round').textContent = this.round;
        document.getElementById('gold').textContent = this.gold;
        document.getElementById('health').textContent = this.health;
        
        const startButton = document.getElementById('start-battle');
        const refreshButton = document.getElementById('refresh-shop');
        
        startButton.disabled = this.phase !== 'preparation';
        refreshButton.disabled = this.gold < 2 || this.phase !== 'preparation';
        
        if (this.health <= 0) {
            startButton.disabled = true;
            refreshButton.disabled = true;
        }
    }
    
    bindEvents() {
        document.getElementById('start-battle').addEventListener('click', () => this.startBattle());
        document.getElementById('next-round').addEventListener('click', () => this.nextRound());
        document.getElementById('refresh-shop').addEventListener('click', () => this.refreshShop());
        
        // Bind drag and drop events for bench
        document.querySelectorAll('.bench-slot').forEach((slot, index) => {
            slot.addEventListener('dragover', (e) => this.handleDragOver(e));
            slot.addEventListener('drop', (e) => this.handleBenchDrop(e, index));
        });
    }
    
    handleBenchDrop(e, index) {
        e.preventDefault();
        e.target.closest('.bench-slot').classList.remove('drag-over');
        
        if (!this.draggedUnit) return;
        
                // Move unit to bench
        this.removeUnitFromAllLocations(this.draggedUnit);
        this.playerBench[index] = this.draggedUnit;
        
        // Check for combinations whenever bench changes
        this.checkForCombinableUnits();
        this.updateUI();
        this.renderBench();
        this.renderArena();
     }
     
     sellUnit(unit) {
         if (!unit || unit.isEnemy) {
             return false;
         }
         
         // Calculate sell price (half of original cost, minimum 1)
         const sellPrice = Math.max(1, Math.floor(unit.cost / 2));
         
         // Remove unit from all locations
         this.removeUnitFromAllLocations(unit);
         
         // Give gold
         this.gold += sellPrice;
         
         this.addToLog(`Sold ${unit.type} (Tier ${unit.tier}) for ${sellPrice} gold`, 'victory');
         this.updateUI();
         this.renderBench();
         this.renderArena();
         
         return true;
     }
     
     bindShopSellEvents() {
         const shopSection = document.querySelector('.shop-section');
         
         shopSection.addEventListener('dragover', (e) => {
             e.preventDefault();
             if (this.draggedUnit && !this.draggedUnit.isEnemy) {
                 shopSection.classList.add('drag-over-sell');
             }
         });
         
         shopSection.addEventListener('dragleave', (e) => {
             shopSection.classList.remove('drag-over-sell');
         });
         
         shopSection.addEventListener('drop', (e) => {
             e.preventDefault();
             shopSection.classList.remove('drag-over-sell');
             
             if (this.draggedUnit && !this.draggedUnit.isEnemy) {
                 this.sellUnit(this.draggedUnit);
             }
         });
     }
}

// Enhanced Unit Class with Movement
class Unit {
    static nextId = 1;
    
    constructor(type, cost) {
        this.id = Unit.nextId++;
        this.type = type;
        this.cost = cost;
        this.tier = 1;
        this.sold = false;
        this.combinable = false;
        this.abilityCooldown = 0;
        this.isEnemy = false;
        this.hasMoved = false;
        
        // Set base stats based on type
        const stats = this.getBaseStats(type);
        this.attack = stats.attack;
        this.health = stats.health;
        this.maxHealth = stats.health;
        this.speed = stats.speed; // Also used as movement range
        this.range = stats.range;
        this.abilityCooldownMax = stats.abilityCooldownMax;
    }
    
    getBaseStats(type) {
        const baseStats = {
            knight: { attack: 8, health: 25, speed: 2, range: 1, abilityCooldownMax: 3 },
            archer: { attack: 6, health: 15, speed: 3, range: 4, abilityCooldownMax: 4 },
            mage: { attack: 12, health: 12, speed: 2, range: 3, abilityCooldownMax: 5 },
            tank: { attack: 5, health: 40, speed: 1, range: 1, abilityCooldownMax: 6 },
            assassin: { attack: 15, health: 10, speed: 4, range: 1, abilityCooldownMax: 3 }
        };
        
        return baseStats[type] || { attack: 5, health: 15, speed: 2, range: 1, abilityCooldownMax: 4 };
    }
    
    upgradeStats() {
        const multiplier = 1.5 + (this.tier - 1) * 0.3;
        this.attack = Math.floor(this.attack * multiplier);
        this.health = Math.floor(this.health * multiplier);
        this.maxHealth = this.health;
    }
    
    getSpecialAbility() {
        const abilities = {
            knight: {
                name: 'Shield Bash',
                execute: async (unit, targetUnits, game) => {
                    const targets = game.getTargetsInRange(unit, targetUnits);
                    if (targets.length > 0) {
                        const target = targets[0];
                        const damage = Math.floor(unit.attack * 1.5);
                        target.health = Math.max(0, target.health - damage);
                        game.addToLog(`${unit.type} shield bashes ${target.type} for ${damage} damage!`, 'ability');
                    }
                }
            },
            archer: {
                name: 'Multi-Shot',
                execute: async (unit, targetUnits, game) => {
                    const targets = game.getTargetsInRange(unit, targetUnits).slice(0, 3);
                    for (let target of targets) {
                        const damage = Math.floor(unit.attack * 0.7);
                        target.health = Math.max(0, target.health - damage);
                        game.addToLog(`${unit.type} multi-shots ${target.type} for ${damage} damage!`, 'ability');
                    }
                }
            },
            mage: {
                name: 'Fireball',
                execute: async (unit, targetUnits, game) => {
                    const aliveTtargets = targetUnits.filter(t => t.health > 0);
                    for (let target of aliveTtargets) {
                        const damage = Math.floor(unit.attack * 0.8);
                        target.health = Math.max(0, target.health - damage);
                    }
                    game.addToLog(`${unit.type} casts fireball hitting all enemies!`, 'ability');
                }
            },
            tank: {
                name: 'Taunt',
                execute: async (unit, targetUnits, game) => {
                    const healAmount = 15 * unit.tier;
                    unit.health = Math.min(unit.maxHealth, unit.health + healAmount);
                    game.addToLog(`${unit.type} taunts and heals for ${healAmount} HP!`, 'heal');
                }
            },
            assassin: {
                name: 'Backstab',
                execute: async (unit, targetUnits, game) => {
                    // Target the furthest enemy (likely back row)
                    const unitPos = game.getUnitPosition(unit);
                    if (!unitPos) return;
                    
                    let furthestTarget = null;
                    let maxDistance = 0;
                    
                    for (let target of targetUnits) {
                        if (target.health <= 0) continue;
                        const targetPos = game.getUnitPosition(target);
                        if (!targetPos) continue;
                        
                        const distance = game.calculateDistance(unitPos, targetPos);
                        if (distance > maxDistance && distance <= unit.range) {
                            maxDistance = distance;
                            furthestTarget = target;
                        }
                    }
                    
                    if (furthestTarget) {
                        const damage = unit.attack * 2;
                        furthestTarget.health = Math.max(0, furthestTarget.health - damage);
                        game.addToLog(`${unit.type} backstabs ${furthestTarget.type} for ${damage} damage!`, 'ability');
                    }
                }
            }
        };
        
        return abilities[this.type] || abilities.knight;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
}); 
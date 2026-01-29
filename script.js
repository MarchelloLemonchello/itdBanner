const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const createBannerButton = document.getElementById('createBanner');
const banner = document.getElementById('banner');
const ctxBanner = banner.getContext('2d');

const copyContainer = document.getElementById('copy');
const copyButton = document.getElementById('copyButton');
const copyTextArea = document.getElementById('copyTextArea');

const startSize = [800,267]

let selection = {
    x: 100,
    y: 100,
    width: startSize[0],
    height: startSize[1],
    aspectRatio: 2,
    isDragging: false,
    dragType: null,
    startX: 0,
    startY: 0,
    startSelection: null
};

let overlaySettings = {
    opacity: 0.7,
    color: '#808080',
    showHandles: true,
    borderColor: '#2196F3',
    borderWidth: 2,
    handleSize: 10
};

let currentImage = null;

let pixelData = []

function init() {
    selection.aspectRatio = selection.width / selection.height;

    setupEventListeners();
    drawOverlay();
}

function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);

    overlayCanvas.addEventListener('mousedown', handleMouseDown);
    overlayCanvas.addEventListener('mousemove', handleMouseMove);
    overlayCanvas.addEventListener('mouseup', handleMouseUp);
    overlayCanvas.addEventListener('mouseleave', handleMouseUp);

    overlayCanvas.addEventListener('touchstart', handleTouchStart);
    overlayCanvas.addEventListener('touchmove', handleTouchMove);
    overlayCanvas.addEventListener('touchend', handleTouchEnd);
}

function handleFileSelect(event) {
    if (event.target.files.length === 0) return;

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            currentImage = img;
            updateCanvasSize();
            drawImage();
            drawOverlay();
        };
        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
}

function updateCanvasSize() {
    if (!currentImage) return;

    const maxWidth = 1200;
    const maxHeight = 800;
    let { width, height } = currentImage;

    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;
    overlayCanvas.width = width;
    overlayCanvas.height = height;

    adjustSelectionToCanvas();
}

function adjustSelectionToCanvas() {
    const maxWidth = overlayCanvas.width * 0.9;
    const maxHeight = overlayCanvas.height * 0.9;

    if (selection.width > maxWidth) {
        selection.width = maxWidth;
        selection.height = selection.width / selection.aspectRatio;
    }

    if (selection.height > maxHeight) {
        selection.height = maxHeight;
        selection.width = selection.height * selection.aspectRatio;
    }

    centerSelection();
}

function drawImage() {
    if (!currentImage) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
}

function drawOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    overlayCtx.fillStyle = `rgba(128, 128, 128, ${overlaySettings.opacity})`;
    overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    overlayCtx.globalCompositeOperation = 'destination-out';
    overlayCtx.fillRect(selection.x, selection.y, selection.width, selection.height);
    overlayCtx.globalCompositeOperation = 'source-over';

    overlayCtx.strokeStyle = overlaySettings.borderColor;
    overlayCtx.lineWidth = overlaySettings.borderWidth;
    overlayCtx.strokeRect(selection.x, selection.y, selection.width, selection.height);

    drawResizeHandles();

    updateCursor();
}

function drawResizeHandles() {
    if (!overlaySettings.showHandles) return;

    const { x, y, width, height } = selection;
    const handleSize = overlaySettings.handleSize;
    const halfHandle = handleSize / 2;

    const handles = [
        // Левый верхний
        { x: x - halfHandle, y: y - halfHandle, type: 'nw' },
        // Правый верхний
        { x: x + width - halfHandle, y: y - halfHandle, type: 'ne' },
        // Левый нижний
        { x: x - halfHandle, y: y + height - halfHandle, type: 'sw' },
        // Правый нижний
        { x: x + width - halfHandle, y: y + height - halfHandle, type: 'se' }
    ];

    handles.forEach(handle => {
        overlayCtx.fillStyle = 'white';
        overlayCtx.strokeStyle = overlaySettings.borderColor;
        overlayCtx.lineWidth = 2;

        overlayCtx.fillRect(handle.x, handle.y, handleSize, handleSize);
        overlayCtx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
}

function getInteractionType(mouseX, mouseY) {
    const { x, y, width, height } = selection;
    const margin = overlaySettings.handleSize + 5;
    const halfHandle = overlaySettings.handleSize / 2;

    if (isPointInRect(mouseX, mouseY, x - halfHandle, y - halfHandle, overlaySettings.handleSize, overlaySettings.handleSize))
        return 'nw';
    if (isPointInRect(mouseX, mouseY, x + width - halfHandle, y - halfHandle, overlaySettings.handleSize, overlaySettings.handleSize))
        return 'ne';
    if (isPointInRect(mouseX, mouseY, x - halfHandle, y + height - halfHandle, overlaySettings.handleSize, overlaySettings.handleSize))
        return 'sw';
    if (isPointInRect(mouseX, mouseY, x + width - halfHandle, y + height - halfHandle, overlaySettings.handleSize, overlaySettings.handleSize))
        return 'se';

    if (mouseX > x && mouseX < x + width && mouseY > y && mouseY < y + height)
        return 'move';

    return null;
}

function isPointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function updateCursor() {
    if (!selection.lastMouseX || !selection.lastMouseY) return;

    const interactionType = getInteractionType(selection.lastMouseX, selection.lastMouseY);

    switch(interactionType) {
        case 'move':
            overlayCanvas.style.cursor = 'move';
            break;
        case 'nw': case 'se':
            overlayCanvas.style.cursor = 'nwse-resize';
            break;
        case 'ne': case 'sw':
            overlayCanvas.style.cursor = 'nesw-resize';
            break;
        default:
            overlayCanvas.style.cursor = 'default';
    }
}

function handleMouseDown(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    selection.dragType = getInteractionType(x, y);
    selection.lastMouseX = x;
    selection.lastMouseY = y;

    if (selection.dragType) {
        selection.isDragging = true;
        selection.startX = x;
        selection.startY = y;
        selection.startSelection = { ...selection };
        e.preventDefault();
    }
}

function handleMouseMove(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    selection.lastMouseX = x;
    selection.lastMouseY = y;

    if (selection.isDragging && selection.startSelection) {
        const dx = x - selection.startX;
        const dy = y - selection.startY;

        switch(selection.dragType) {
            case 'move':
                selection.x = Math.max(0, Math.min(overlayCanvas.width - selection.width, selection.startSelection.x + dx));
                selection.y = Math.max(0, Math.min(overlayCanvas.height - selection.height, selection.startSelection.y + dy));
                break;

            case 'nw':
                resizeFromNW(dx, dy);
                break;

            case 'ne':
                resizeFromNE(dx, dy);
                break;

            case 'sw':
                resizeFromSW(dx, dy);
                break;

            case 'se':
                resizeFromSE(dx, dy);
                break;
        }

        drawOverlay();
    } else {
        updateCursor();
    }
}

function resizeFromNW(dx, dy) {
    const { startSelection, aspectRatio } = selection;
    const maxX = startSelection.x + startSelection.width - 50;
    const maxY = startSelection.y + startSelection.height - 50;

    const constrainedDx = Math.min(dx, startSelection.width - 50);
    const constrainedDy = Math.min(dy, startSelection.height - 50);

    let newWidth = startSelection.width - constrainedDx;
    let newHeight = newWidth / aspectRatio;

    if (newHeight < 50) {
        newHeight = Math.max(50, startSelection.height - constrainedDy);
        newWidth = newHeight * aspectRatio;
    }

    selection.x = startSelection.x + startSelection.width - newWidth;
    selection.y = startSelection.y + startSelection.height - newHeight;
    selection.width = newWidth;
    selection.height = newHeight;

    constrainToCanvas();
}

function resizeFromNE(dx, dy) {
    const { startSelection, aspectRatio } = selection;
    const maxY = startSelection.y + startSelection.height - 50;

    const constrainedDy = Math.min(dy, startSelection.height - 50);

    let newWidth = startSelection.width + dx;
    let newHeight = newWidth / aspectRatio;

    if (newWidth < 50) {
        newWidth = 50;
        newHeight = newWidth / aspectRatio;
    }

    newHeight = startSelection.height - constrainedDy;
    newWidth = newHeight * aspectRatio;

    selection.y = startSelection.y + startSelection.height - newHeight;
    selection.width = newWidth;
    selection.height = newHeight;

    constrainToCanvas();
}

function resizeFromSW(dx, dy) {
    const { startSelection, aspectRatio } = selection;
    const maxX = startSelection.x + startSelection.width - 50;

    const constrainedDx = Math.min(dx, startSelection.width - 50);

    let newWidth = startSelection.width - constrainedDx;
    let newHeight = newWidth / aspectRatio;

    if (newHeight < 50) {
        newHeight = 50;
        newWidth = newHeight * aspectRatio;
    }

    newHeight = startSelection.height + dy;
    newWidth = newHeight * aspectRatio;

    selection.x = startSelection.x + startSelection.width - newWidth;
    selection.width = newWidth;
    selection.height = newHeight;

    constrainToCanvas();
}

function resizeFromSE(dx, dy) {
    const { startSelection, aspectRatio } = selection;

    let newWidth = startSelection.width + dx;
    let newHeight = newWidth / aspectRatio;

    const heightFromY = startSelection.height + dy;
    const widthFromY = heightFromY * aspectRatio;

    if (Math.abs(dy) > Math.abs(dx)) {
        newHeight = heightFromY;
        newWidth = widthFromY;
    }

    if (newWidth < 50) {
        newWidth = 50;
        newHeight = newWidth / aspectRatio;
    }

    if (newHeight < 50) {
        newHeight = 50;
        newWidth = newHeight * aspectRatio;
    }

    selection.width = newWidth;
    selection.height = newHeight;

    constrainToCanvas();
}

function constrainToCanvas() {
    const { x, y, width, height } = selection;

    if (x < 0) {
        selection.x = 0;
    }

    if (y < 0) {
        selection.y = 0;
    }

    if (x + width > overlayCanvas.width) {
        selection.x = overlayCanvas.width - width;
    }

    if (y + height > overlayCanvas.height) {
        selection.y = overlayCanvas.height - height;
    }
}

function handleMouseUp() {
    selection.isDragging = false;
    selection.dragType = null;
    selection.startSelection = null;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    overlayCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    overlayCanvas.dispatchEvent(mouseEvent);
}

function handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup');
    overlayCanvas.dispatchEvent(mouseEvent);
}

function centerSelection() {
    selection.x = Math.max(0, (overlayCanvas.width - selection.width) / 2);
    selection.y = Math.max(0, (overlayCanvas.height - selection.height) / 2);

    drawOverlay();
}

createBannerButton.addEventListener('click',cteateBanner)

function cteateBanner() {
    if (!fileInput.value) return;
    const w = selection.width;
    const h = selection.height;

    banner.width = startSize[0]
    banner.height = startSize[1]



    const shiftX =  selection.width/  startSize[0]
    const shiftY = selection.height/  startSize[1]
    for (let i = 0; i < startSize[1]; i++) {
        pixelData[i]=[]
        for (let j = 0; j < startSize[0]; j++) {
            const coordinateX = selection.x + Math.round(shiftX*j)
            const coordinateY = selection.y + Math.round(shiftY*i)

            const [r,g,b] = ctx.getImageData(coordinateX, coordinateY, 1, 1).data;
            pixelData[i][j] = [r,g,b]
            drawBannerPoint(j,i,`rgb(${r}, ${g}, ${b})`)
        }
    }

    showCopyContainer()


}


function drawBannerPoint(x,y,color) {
    ctxBanner.fillStyle = color;
    ctxBanner.fillRect(x, y, 1, 1);
}

function showCopyContainer() {
    copyContainer.style.display = 'block';
    copyTextArea.value = `let c=document.getElementsByClassName('drawing-canvas')[0].getContext('2d');let d=[${pixelData}];for(let i=0;i<267;i++){for(let j=0;j<800;j++){let o=(i*800+j)*3;c.fillStyle=\`rgb(\${d[o]},\${d[o+1]},\${d[o+2]})\`;c.fillRect(j,i,1,1);}}`
}

async function copy() {
    try {
        await navigator.clipboard.writeText(copyTextArea.value);
    } catch (err) {
        console.error('Ошибка при копировании: ', err);
    }
}

init();
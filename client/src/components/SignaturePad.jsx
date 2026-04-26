import { useRef } from "react";
import { Box, Button } from "@mui/material";

export default function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  let drawing = false;

  const startDraw = (e) => {
    drawing = true;
    draw(e);
  };

  const endDraw = () => {
    drawing = false;
  };

  const draw = (e) => {
    if (!drawing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";

    const x = e.touches
      ? e.touches[0].clientX - rect.left
      : e.clientX - rect.left;

    const y = e.touches
      ? e.touches[0].clientY - rect.top
      : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <Box>
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        style={{ border: "1px solid #ccc", borderRadius: 8 }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />

      <Box mt={1} display="flex" gap={1}>
        <Button variant="outlined" onClick={clear}>
          Təmizlə
        </Button>
        <Button variant="contained" onClick={save}>
          Yadda saxla
        </Button>
      </Box>
    </Box>
  );
}

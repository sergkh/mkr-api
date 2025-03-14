import express, { Request, Response } from "express";
import { MkrApi, TeacherScheduleRequest } from "./mkr";
import { validate, parStructureId, parChairId, parTeacherId, qryDateRange, ValidatedRequest } from "./validation"

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SERVICE_URL) {
  throw new Error("Set SERVICE_URL pointing to a MKR instance");
}

const url = process.env.SERVICE_URL;
const api = new MkrApi(url);

app.use(express.json());

app.get("/structures", async (req: Request, res: Response) => {  
  const structures = await api.loadStructures()
  res.json(structures)
});

app.get("/structures/:structureId/chairs", validate(parStructureId), async (req: Request, res: Response) => {  
  const chairs = await api.loadChairs(parseInt(req.params.structureId))
  res.json(chairs)
});

app.get("/structures/:structureId/chairs/:chairId/teachers", validate(parStructureId, parChairId),  async (req: Request, res: Response) => {
  const reqData = (req as ValidatedRequest).validData
  console.log('Requesting teachers for: ', reqData)
  const teachers = await api.loadTeachers(reqData.structureId, reqData.chairId)
  res.json(teachers)
});

app.get("/structures/:structureId/chairs/:chairId/teachers/:teacherId/schedule", 
  validate(parStructureId, parChairId, parTeacherId, qryDateRange), 
  async (req: Request, res: Response) => {  
    const request = (req as ValidatedRequest).validData as TeacherScheduleRequest

    console.log('Requesting shedule for: ', request)

    const schedule = await api.loadTeacherSchedule(request)

    res.json(schedule)
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
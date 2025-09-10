import express, { Request, Response, NextFunction } from "express";
import { GroupScheduleRequest, MkrApi, TeacherScheduleRequest } from "./mkr";
import { validate, parStructureId, parChairId, parTeacherId, parFacultyId, parCourse, parGroupId, qryDateRange, ValidatedRequest } from "./validation"

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SERVICE_URL) {
  throw new Error("Set SERVICE_URL pointing to a MKR instance");
}

const url = process.env.SERVICE_URL;
const api = new MkrApi(url)

app.use(express.json())
app.use(express.static('public'))

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error: ", err.message);
  res.status(500).json({ error: err.message });
});

app.get("/structures", async (req: Request, res: Response) => {  
  console.log('Requesting structures')
  const structures = await api.loadStructures()
  res.json(structures)
});

app.get("/structures/:structureId", async (req: Request, res: Response) => {  
  console.log('Requesting structure with ID: ', req.params.structureId)
  const structures = await api.loadStructures()
  
  const structure = structures.find(s => s.id === req.params.structureId)
  if (!structure) {
    return res.status(404).json({ error: "Structure not found" });
  }
  // HATEOAS links
  const links = {
    chairs: `/structures/${structure.id}/chairs`,
    faculties: `/structures/${structure.id}/faculties`
  };

  res.json(Object.assign(structure, {links}))
});


app.get("/structures/:structureId/chairs", validate(parStructureId), async (req: Request, res: Response) => {  
  console.log('Requesting chairs for: ', req.params.structureId)
  const chairs = await api.loadChairs(parseInt(req.params.structureId))
  res.json(chairs)
});

app.get("/structures/:structureId/chairs/:chairId", validate(parStructureId, parChairId), async (req: Request, res: Response) => {  
  console.log('Requesting chair info for: ' + req.params.structureId + ' chair: ' + req.params.chairId) 
  const chairs = await api.loadChairs(parseInt(req.params.structureId))
  
  const chair = chairs.find(s => s.id === req.params.chairId)
  if (!chair) {
    return res.status(404).json({ error: "Chair is not found" });
  }

  const links = { teachers: `/structures/${req.params.structureId}/chairs/${req.params.chairId}/teachers` }

  res.json(Object.assign(chair, {links}))
});


app.get("/structures/:structureId/faculties", validate(parStructureId), async (req: Request, res: Response) => {  
  console.log('Requesting faculties for: ', req.params)
  const faculties = await api.loadFaculties(parseInt(req.params.structureId))
  res.json(faculties)
});

app.get("/structures/:structureId/faculties/:facultyId", validate(parStructureId, parFacultyId), async (req: Request, res: Response) => {  
  console.log('Requesting faculty for: ' + req.params.structureId + ' faculty: ' + req.params.facultyId)

  const faculties = await api.loadFaculties(parseInt(req.params.structureId))

  const faculty = faculties.find(f => f.id === req.params.facultyId)
  if (!faculty) {
    return res.status(404).json({ error: "Faculty not found" });
  }

  const links = {
    courses: `/structures/${req.params.structureId}/faculties/${req.params.facultyId}/courses`
  }

  res.json(Object.assign(faculty, {links}))
});

app.get("/structures/:structureId/faculties/:facultyId/courses", validate(parStructureId,parFacultyId), async (req: Request, res: Response) => {  
  console.log('Requesting courses for: ', req.params)
  const courses = await api.loadCourses(parseInt(req.params.structureId), parseInt(req.params.facultyId))
  res.json(courses)
});

app.get("/structures/:structureId/faculties/:facultyId/courses/:course", validate(parStructureId, parFacultyId, parCourse), async (req: Request, res: Response) => {  
  console.log('Requesting courses for: ', req.params)
  const courses = await api.loadCourses(parseInt(req.params.structureId), parseInt(req.params.facultyId))
  const course = courses.find(c => c.id === req.params.course)
  
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }
  
  const links = {
    groups: `/structures/${req.params.structureId}/faculties/${req.params.facultyId}/courses/${req.params.course}/groups`
  }

  res.json(Object.assign(course, { links }))
});

app.get("/structures/:structureId/faculties/:facultyId/courses/:course/groups", validate(parStructureId, parFacultyId, parCourse), async (req: Request, res: Response) => {
  console.log('Requesting groups for: ', req.params)
  const groups = await api.loadGroups(parseInt(req.params.structureId), parseInt(req.params.facultyId), parseInt(req.params.course))
  res.json(groups)
});

app.get("/structures/:structureId/faculties/:facultyId/groups", validate(parStructureId, parFacultyId), async (req: Request, res: Response) => {
  console.log('Requesting faculty groups for: ', req.params)
  const groups = await api.loadFacultyGroups(parseInt(req.params.structureId), parseInt(req.params.facultyId))
  res.json(groups)
});

app.get("/structures/:structureId/faculties/:facultyId/courses/:course/groups/:groupId", validate(parStructureId, parFacultyId, parCourse, parGroupId), async (req: Request, res: Response) => {
  console.log('Requesting groups for: ', req.params)
  const groups = await api.loadGroups(parseInt(req.params.structureId), parseInt(req.params.facultyId), parseInt(req.params.course))
  const group = groups.find(g => g.id === req.params.groupId)
  
  if (!group) {
    return res.status(404).json({ error: "Group not found" });
  }
  
  const links = {
    schedule: `/structures/${req.params.structureId}/faculties/${req.params.facultyId}/courses/${req.params.course}/groups/${req.params.groupId}/schedule`
  }

  res.json(Object.assign(group, { links }))  
});

app.get("/structures/:structureId/faculties/:facultyId/courses/:course/groups/:groupId/schedule", 
  validate(parStructureId, parFacultyId, parCourse, parGroupId, qryDateRange), 
  async (req: Request, res: Response) => {
  const reqData = (req as ValidatedRequest).validData as GroupScheduleRequest
  console.log('Requesting group schedule for: ', reqData)
  const schedule = await api.loadGroupSchedule(reqData)
  res.json(schedule)
});

app.get("/structures/:structureId/chairs/:chairId/teachers", validate(parStructureId, parChairId),  async (req: Request, res: Response) => {
  const reqData = (req as ValidatedRequest).validData
  console.log('Requesting teachers for: ', reqData)
  const teachers = await api.loadTeachers(reqData.structureId, reqData.chairId)
  res.json(teachers)
});

app.get("/structures/:structureId/chairs/:chairId/teachers/:teacherId", validate(parStructureId, parChairId, parTeacherId), async (req: Request, res: Response) => {
  const reqData = (req as ValidatedRequest).validData
  console.log('Requesting teachers for: ', reqData)
  const teachers = await api.loadTeachers(reqData.structureId, reqData.chairId)
  const teacher = teachers.find(t => t.id === reqData.teacherId)
  
  if (!teacher) {
    return res.status(404).json({ error: "Teacher not found" });
  }

  const links = {
    schedule: `/structures/${reqData.structureId}/chairs/${reqData.chairId}/teachers/${reqData.teacherId}/schedule`
  }
  
  res.json(Object.assign(teacher, {links}))
});

app.get("/structures/:structureId/chairs/:chairId/teachers/:teacherId/schedule", 
  validate(parStructureId, parChairId, parTeacherId, qryDateRange), 
  async (req: Request, res: Response) => {  
    const request = (req as ValidatedRequest).validData as TeacherScheduleRequest

    console.log('Requesting shedule for: ', request)

    const schedule = await api.loadTeacherSchedule(request)

    res.json(schedule)
});

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: "Resource not found", path: req.originalUrl });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
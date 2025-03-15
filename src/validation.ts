import { param, query, matchedData, validationResult } from 'express-validator';
import e, { Request, Response } from "express";

export interface ValidatedRequest extends Request {
  validData: any
}

/**
 * Usage:
 * app.get("/url", validate( rules list here ), async (req: Request, res: Response) => { res.status(201); });
 * @param rules 
 * @returns 
 */
function validate(...rules: any): any[] {
  return [...rules.flat(), (req: Request, res: Response, next: any) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) {
      (req as ValidatedRequest).validData = matchedData(req)
      return next()
    }
    return res.status(400).json({ errors: errors.array() })
  }]
}

const parStructureId = param('structureId').isInt()
const parChairId = param('chairId').isInt()
const parTeacherId = param('teacherId').isInt()
const parFacultyId = param('facultyId').isInt()
const parCourse = param('course').isInt()
const parGroupId = param('groupId').isInt()
const qryDateRange = [
  query('startDate').isISO8601().toDate().optional(),
  query('endDate').isISO8601().toDate().optional()
]

export { 
  validate, 
  parStructureId,
  parChairId,
  parTeacherId,
  parFacultyId,
  parGroupId,
  parCourse,
  qryDateRange
}
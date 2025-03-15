import{ JSDOM } from "jsdom"
import Cache from 'timed-cache'
import dayjs from 'dayjs'

const lessonTypes = new Map([
  ["lesson-1", "lection"],
  ["lesson-2", "practice"],
  ["lesson-5", "exam"],
  ["lesson-9", "lection_in_absentia"],
  ["lesson-10", "practice_in_absentia"],
]);

const cacheTTL = 1000 * 60 * 60 // 1 hour

export type KeyValuePair = {
  id: string,
  name: string
}

export type TeacherScheduleRequest = {
  structureId: number,
  chairId: number,
  teacherId: number,
  startDate?: Date,
  endDate?: Date
}

export type GroupScheduleRequest = {
  structureId: number,
  facultyId: number,
  course: number,
  groupId: number,
  startDate?: Date,
  endDate?: Date
}

export type Event = {
  name: string,
  place: string,
  group?: string,
  teacher?: string,
  type: string,
  start: string,
  end: string,
  updated: boolean
}

function extractCsrfToken(dom: JSDOM): string | null {
  const metaTag = dom.window.document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : null;
}

export class MkrApi {
    readonly url: string

    private csrfToken: string | null = null
    private storedCookies: string = ''
    
    private structures: KeyValuePair[] = []
    private chairs: Cache<KeyValuePair[]> = new Cache({ defaultTtl: cacheTTL })
    private faculties: Cache<KeyValuePair[]> = new Cache({ defaultTtl: cacheTTL })
    private groups: Cache<KeyValuePair[]> = new Cache({ defaultTtl: cacheTTL })
    private teachers: Cache<KeyValuePair[]> = new Cache({ defaultTtl: cacheTTL })
    private teacherSchedules: Cache<Event[]> = new Cache({ defaultTtl: cacheTTL })
    private groupSchedules: Cache<Event[]> = new Cache({ defaultTtl: cacheTTL })

    constructor(url: string) {
      this.url = url
    }    

    async loadStructures(): Promise<KeyValuePair[]> {
      if (this.structures.length > 0) {
        return this.structures;
      }
  
      const response = await this.get(this.teachersUrl());
      const dom = new JSDOM(response);
  
      this.csrfToken = extractCsrfToken(dom);
      console.log("Extracted CSRF Token:", this.csrfToken);
  
      // the first node is a placeholder
      return this.parseSelect('select[name="TimeTableForm[structureId]"] option:not(:first-child)', dom.window.document);
    }
    
    async loadChairs(structureId: number): Promise<KeyValuePair[]> {
      const cached = this.chairs.get("" + structureId)
      
      if (cached) {
        return cached
      }

      const data = {
          '_csrf-frontend': this.csrfToken,
          'TimeTableForm[structureId]' : structureId
      }
  
      const html = await this.sendForm(this.teachersUrl(), data);
      const dom = new JSDOM(html);
      this.csrfToken = extractCsrfToken(dom);
  
      const chairs = this.parseSelect('select[name="TimeTableForm[chairId]"] option:not(:first-child)', dom.window.document);
      
      this.chairs.put("" + structureId, chairs)
      
      return chairs
    }

    async loadFaculties(structureId: number): Promise<KeyValuePair[]> {
      const cached = this.faculties.get("" + structureId)
      
      if (cached) {
        return cached
      }

      const data = {
          '_csrf-frontend': this.csrfToken,
          'TimeTableForm[structureId]' : structureId
      }
  
      const html = await this.sendForm(this.groupsUrl(), data);
      const dom = new JSDOM(html);
      this.csrfToken = extractCsrfToken(dom);
  
      const faculties = this.parseSelect('select[name="TimeTableForm[facultyId]"] option:not(:first-child)', dom.window.document);
      
      this.faculties.put("" + structureId, faculties)
      
      return faculties
    }

    async loadCourses(structureId: number, facultyId: number): Promise<KeyValuePair[]> {
      // it's always the same
      return [1, 2, 3, 4, 5, 6, 7].map((i) => {
        return { id: i.toString(), name: `${i} Курс` } as KeyValuePair
      });
    }

    async loadGroups(structureId: number, facultyId: number, course: number): Promise<KeyValuePair[]> {
      const cached = this.groups.get("" + structureId + "_" + facultyId + "_" + course)
      
      if (cached) {
        return cached
      }

      const data = {
          '_csrf-frontend': this.csrfToken,
          'TimeTableForm[structureId]' : structureId,
          'TimeTableForm[facultyId]': facultyId,
          'TimeTableForm[course]': course
      }
  
      const html = await this.sendForm(this.groupsUrl(), data);
      const dom = new JSDOM(html);
      this.csrfToken = extractCsrfToken(dom);
  
      const groups = this.parseSelect('select[name="TimeTableForm[groupId]"] option:not(:first-child)', dom.window.document);
      
      this.groups.put("" + structureId + "_" + facultyId + "_" + course, groups)
      
      return groups
    }
    
    async loadTeachers(structureId: number, chairId: number): Promise<KeyValuePair[]> {
        const cached = this.teachers.get("" + structureId + "_" + chairId)
        
        if (cached) {
          return cached
        }

        const data = {
            '_csrf-frontend': this.csrfToken,
            'TimeTableForm[structureId]' : structureId,
            'TimeTableForm[chairId]' : chairId,
        }
    
        const html = await this.sendForm(this.teachersUrl(), data);
        const dom = new JSDOM(html);
        this.csrfToken = extractCsrfToken(dom);

        const teachers = this.parseSelect('select[name="TimeTableForm[teacherId]"] option:not(:first-child)', dom.window.document);

        this.chairs.put("" + structureId + "_" + chairId, teachers)
        
        return teachers
    }

    async loadGroupSchedule(request: GroupScheduleRequest): Promise<Event[]> {
      // default to today
      const start = request.startDate ? dayjs(request.startDate) : dayjs()

      // default to 1 week from start date
      const end = request.endDate ? dayjs(request.endDate) : start.add(1, 'week')
      
      const data = {
        '_csrf-frontend': this.csrfToken,
        'TimeTableForm[structureId]' : request.structureId,
        'TimeTableForm[facultyId]' : request.facultyId,
        'TimeTableForm[course]' : request.course,
        'TimeTableForm[groupId]' : request.groupId,
        'date-picker': `${start.format('DD.MM.YYYY')} - ${end.format('DD.MM.YYYY')}`,
        'TimeTableForm[dateStart]' : start.format('DD.MM.YYYY'),
        'TimeTableForm[dateEnd]' : end.format('DD.MM.YYYY'),
        'TimeTableForm[indicationDays]' : 5 // do not really care
      }

      const cacheKey = `${request.structureId}_${request.facultyId}_${request.course}_${request.groupId}_${start.format('DD.MM.YYYY')}_${end.format('DD.MM.YYYY')}`
      const cached = this.groupSchedules.get(cacheKey)
      if (cached) {
        return cached
      }
  
      const html = await this.sendForm(this.groupsUrl(), data)  
      this.csrfToken = extractCsrfToken(new JSDOM(html));
      
      // Events are stored in a JSON array in the HTML
      const eventsRegex = /\"events\":(\[\{.*?\}\])/g  
      const parsedEvents = eventsRegex.exec(html)
  
      if (!parsedEvents) {
        console.log("Empty response on data: ", html);
        throw new Error('No events data found. Check the dates range');
      }
  
      const eventsList = JSON.parse(parsedEvents[1])

      const events = eventsList.map((event: any) => {
        const updated = event.className.includes('lesson-updated')
        const type = lessonTypes.get(event.className.replace('lesson-updated', '')) || event.className
        const title = event.title
        
        // The format is "ООП [Лк]\n ауд. Храм\n Teacher"
        const [name, place, teacher] = title.split('\n').map((s: string) => s.trim().replace('&lt;', ''))

        return {
          name, 
          place, 
          teacher, 
          type,
          start: event.start,
          end: event.end,
          updated
        } as Event
      })

      this.groupSchedules.put(cacheKey, events)

      return events
    }

    async loadTeacherSchedule(request: TeacherScheduleRequest): Promise<Event[]> {
      // default to today
      const start = request.startDate ? dayjs(request.startDate) : dayjs()

      // default to 1 week from start date
      const end = request.endDate ? dayjs(request.endDate) : start.add(1, 'week')
      
      const data = {
        '_csrf-frontend': this.csrfToken,
        'TimeTableForm[structureId]' : request.structureId,
        'TimeTableForm[chairId]' : request.chairId,
        'TimeTableForm[teacherId]' : request.teacherId,
        'date-picker': `${start.format('DD.MM.YYYY')} - ${end.format('DD.MM.YYYY')}`,
        'TimeTableForm[dateStart]' : start.format('DD.MM.YYYY'),
        'TimeTableForm[dateEnd]' : end.format('DD.MM.YYYY'),
        'TimeTableForm[indicationDays]' : 5 // do not really care
      }
  
      const cacheKey = `${request.structureId}_${request.chairId}_${request.teacherId}_${start.format('DD.MM.YYYY')}_${end.format('DD.MM.YYYY')}`
      const cached = this.teacherSchedules.get(cacheKey)
      if (cached) {
        return cached
      }

      const html = await this.sendForm(this.teachersUrl(), data)  
      this.csrfToken = extractCsrfToken(new JSDOM(html));
      
      // Events are stored in a JSON array in the HTML
      const eventsRegex = /\"events\":(\[\{.*?\}\])/g  
      const parsedEvents = eventsRegex.exec(html)
  
      if (!parsedEvents) {
        console.log("Empty response on data: ", html);
        throw new Error('No events data found. Check the dates range');
      }
  
      const eventsList = JSON.parse(parsedEvents[1])

      const events = eventsList.map((event: any) => {
        const updated = event.className.includes('lesson-updated')
        const type = lessonTypes.get(event.className.replace('lesson-updated', '')) || event.className
        const title = event.title

        // The format is "ООП [Лк]\n ауд. Храм\n КН-20-1, КН-20-2"
        const [name, place, group] = title.split('\n').map((s: string) => s.trim().replace('&lt;', ''))

        return {
          name, 
          place, 
          group, 
          type,
          start: event.start,
          end: event.end,
          updated
        } as Event
      })

      this.teacherSchedules.put(cacheKey, events)

      return events
    }

    private async get(url: string): Promise<string> {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Cookie': this.storedCookies,
                'X-CSRF-Token': this.csrfToken ? this.csrfToken : ''
            }
        });
    
        const receivedCookies = response.headers.get('set-cookie');
    
        if (receivedCookies) {
            console.log("Received Cookies:", receivedCookies);
            this.storedCookies = receivedCookies;
        }
    
        return await response.text();
    }
    
    private async sendForm(url: string, data: any): Promise<string> {    
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': this.storedCookies,
                'X-CSRF-Token': this.csrfToken ? this.csrfToken : ''
            },
            body: new URLSearchParams(data)
        });
        
        const receivedCookies = response.headers.get('set-cookie');
    
        if (receivedCookies) {
            console.log("Received Cookies:", receivedCookies);
            this.storedCookies = receivedCookies;
        }
    
        const html = await response.text();
    
        if (response.status === 400) {            
            this.csrfToken = extractCsrfToken(new JSDOM(html));
            console.log("Got 400 status. Updating CSRF Token to: ", this.csrfToken);
            return await this.sendForm(url, data);
        } else {
            return html
        }
    }

    private teachersUrl = () => this.url + '/teacher?type=1';
    
    private groupsUrl = () => this.url + '/group?type=1';

    private parseSelect(query: string, document: Document): KeyValuePair[] {
      const components = document.querySelectorAll(query);
  
      return Array.from(components).map((option) => {
        return { id: option.getAttribute('value'), name: option.textContent } as KeyValuePair
      })
    }
}
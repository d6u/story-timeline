import { graphql, type ResultOf } from './graphql.ts'

export const ProjectsQuery = graphql(`
  query Projects {
    projects { id name }
  }
`)

/** The whole story in one round trip. assemble() turns the result into ProjectData. */
export const ProjectQuery = graphql(`
  query Project($id: ID!) {
    project(id: $id) {
      id
      name
      acts { name position span description }
      places { key position name realm parentKey description }
      characters {
        key id name description category kind position color
        names { name position lang note }
        relations { position otherKey relation mutual member sinceKey untilKey tone }
        arcStages { position stage time sinceKey description }
      }
      events {
        key id title description isCore sortOrder actName time placeKey confidence
        participants { characterKey position presence exit }
        links { position toKey relation mutual note kind }
        sources { sourceKey ref position }
      }
      learnings {
        key position text kind description
        characters { learningKey position characterKey sinceKey untilKey time note }
      }
      sources { key position title lang location note }
    }
  }
`)

export type ProjectResult = NonNullable<ResultOf<typeof ProjectQuery>['project']>

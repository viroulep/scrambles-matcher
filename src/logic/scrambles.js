import { flatMap, updateIn, groupBy, sortBy } from './utils';
import { idsFromRound } from './wcif';

let uniqueScrambleSetId = 1;

// The WCIF defines the following fields:
// { id, scrambles: [], extraScrambles: [] }
// Internally we want to store a couple more information:
// {
//   sheetName: String, title: String, generatedAttemptNumber: null|Integer,
//   eventId: String, roundNumber: Integer
// }
// This will let us easily (automatically) match and display scrambles in the WCIF.
// Keeping in mind we'll need to support loading scrambles from the uploaded WCIF!
const tnoodleSheetsToInternal = (filename, sheets) => sheets.map(sheet => {
    return {
      id: uniqueScrambleSetId++,
      scrambles: sheet.scrambles || [],
      extraScrambles: sheet.extraScrambles || [],
      title: sheet.title,
      sheetName: filename,
      generatedAttemptNumber: sheet.generatedAttemptNumber,
      eventId: sheet.event,
      roundNumber: sheet.round,
    }
});

const splitMultiFm = scramble => {
  let attemptNumber = 1;
  // Split the scramble to have one object per attempt (will be useful later ;))
  return scramble.scrambles.map(sequence => { return {
    ...scramble,
    scrambles: [sequence],
    title: `${scramble.title} Attempt ${attemptNumber}`,
    scrambleSetId: `${scramble.scrambleSetId}-a${attemptNumber}`,
    generatedAttemptNumber: attemptNumber++,
  }});
}

const addScrambleSetsIfMissing = rounds => rounds.map(r => {
  return {
    ...r,
    scrambleSets: r.scrambleSets || [],
  }
});

const scrambleSetsForRound = (usedScramblesId, round, uploadedScrambles) => {
  // We don't want to overwrite existing scrambles,
  // so for all rounds *without* scramble we:
  //   - for all scramble in uploadedScrambles (in order they were uploaded):
  //     - look for a set of matching (event, round number)
  // This way if we ever upload multiple sets of scramble for the same round
  // we just assign the first one (as the others are likely extra scrambles used
  // in rounds we can't figure out programatically !).
  // We also want to return a new WCIF as the wcif passed is most likely taken
  // from a React state.
  const [eventId, roundNumber] = idsFromRound(round);
  let firstMatchingSheets = [];
  uploadedScrambles.find(up => {
    firstMatchingSheets = up.sheets.filter(s => !usedScramblesId.includes(s.id) && s.eventId === eventId && s.roundNumber === roundNumber);
    return firstMatchingSheets.length !== 0;
  });
  // We don't actually need to update the usedScramblesId, because we never try to
  // get the same eventId/roundNumber again, so usedScramblesId only need to
  // contain the scrambles in use before the autoAssign thing.
  if (["333fm", "333mbf"].includes(eventId)) {
    // Assign the attemptNumber from the generated number
    return firstMatchingSheets.map(s => {
      return {
        ...s,
        attemptNumber: s.generatedAttemptNumber,
      };
    });
  } else {
    return firstMatchingSheets;
  }
};

export const allScramblesForEvent = (scrambles, eventId, usedIds) =>
  flatMap(scrambles, scramble => scramble.sheets.filter(s => (s.eventId === eventId && !usedIds.includes(s.id))));

export const usedScramblesIdsForEvent = (events, eventId) =>
  flatMap(flatMap(events.filter(e => e.id === eventId), e => flatMap(e.rounds, r => r.scrambleSets)), s => s.id);

export const updateMultiAndFm = scrambles => flatMap(scrambles, s => (s.event === "333fm" || s.event === "333mbf") ? splitMultiFm(s) : s)

export const ensureScramblesMember = events => events.map(e => updateIn(e, ["rounds"], addScrambleSetsIfMissing));

export const transformUploadedScrambles = uploadedJson => {
  const updater = sheets => tnoodleSheetsToInternal(uploadedJson.competitionName, sheets);
  return updateIn(uploadedJson, ["sheets"], updater);
};

// 65 is the char code for 'A'
export const prefixForIndex = index => String.fromCharCode(65 + index);

export const internalScramblesToWcifScrambles = (eventId, scrambles) => {
  if (scrambles.length === 0)
    return scrambles;
  if (eventId === "333mbf") {
    // We need to combine all scrambles for each attempt,
    // in the end there will be one scramble sheet with X scramble sequences,
    // where X is the number of attempts.
    let scramblesByAttempt = groupBy(scrambles, s => s.attemptNumber);
    let sheet = {
      id: scrambles[0].id,
      scrambles: [],
      extraScrambles: [],
    }
    Object.keys(scramblesByAttempt).sort().forEach(number =>
      sheet.scrambles.push(scramblesByAttempt[number].map(s => s.scrambles).join("\n")));
    return [sheet];
  } else if (eventId === "333fm") {
    // We can't track yet in the WCIF which scramble was for witch attempt,
    // so let's just sort them by attempt id and combine them in one
    // scramble sheet.
    // There is usually only one group for FM, the only case where we would
    // like more scramble than expected is when something terrible happened
    // and an extra was needed.
    return [{
      id: scrambles[0].id,
      scrambles: flatMap(sortBy(scrambles, s => s.attemptNumber), s => s.scrambles),
      extraScrambles: [],
    }];
  }
  return scrambles.map(set => {
    return {
      id: set.id,
      scrambles: set.scrambles,
      extraScrambles: set.extraScrambles,
    }
  });
};

export const autoAssignScrambles = (wcif, uploadedScrambles) => {
  let usedScrambleIdsByEvent = {};
  wcif.events.forEach(e => {
    usedScrambleIdsByEvent[e.id] = usedScramblesIdsForEvent(wcif.events, e.id);
  });
  return {
    ...wcif,
    events: wcif.events.map(e => {
      return {
        ...e,
        rounds: e.rounds.map(r => {
          return {
            ...r,
            scrambleSets: r.scrambleSets.length === 0
              ? scrambleSetsForRound(usedScrambleIdsByEvent[e.id], r, uploadedScrambles)
              : r.scrambleSets,
          };
        }),
      };
    }),
  };
}

export const clearScrambles = wcif => {
  return {
    ...wcif,
    events: wcif.events.map(e => {
      return {
        ...e,
        rounds: e.rounds.map(r => {
          return {
            ...r,
            scrambleSets: [],
          };
        }),
      };
    }),
  };
}
import React, { Fragment } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { internalWcifToWcif, internalWcifToResultsJson } from '../../../logic/wcif';
import { autoAssignScrambles, clearScrambles } from '../../../logic/scrambles';
import CompetitionDetailsPanel from './CompetitionDetailsPanel';
import MatchingScramblesPanel from './MatchingScramblesPanel';
import UploadedScramblesPanel from './UploadedScramblesPanel';


const downloadFile = (wcif, exporter, filename="wcif.json") => {
  let blob = new Blob([JSON.stringify(exporter(wcif), null, 2)], { type: 'application/json' });
  let blobURL = window.URL.createObjectURL(blob);

  let tmp = document.createElement('a');
  tmp.href = blobURL;
  tmp.setAttribute('download', filename);
  document.body.appendChild(tmp);
  tmp.click();
};

const useStyles = makeStyles(theme => ({
  input: {
    display: 'none',
  },
  addJsonButton: {
    width: "100%",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  extendedIcon: {
    marginRight: theme.spacing(1),
  },
  button: {
    marginRight: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  paper: {
    padding: 16,
    marginBottom: theme.spacing(2),
  },
  h: {
    marginBottom: theme.spacing(1),
  }
}));

const CompetitionInfo = ({ wcif, uploadedScrambles, uploadAction, handleWcifChange, version }) => {
  const classes = useStyles();
  // FIXME: restore the check ;)
  //const exportUnavailable = wcif.events.some(e => e.rounds.some(r => r.scrambleSets.length === 0));
  const exportAvailable = true;

  const actionDownloadWcif = () => downloadFile(wcif, internalWcifToWcif);

  const actionDownloadResultsJson = () =>
    downloadFile(wcif, wcif => internalWcifToResultsJson(wcif, version), `Results for ${wcif.name}.json`);

  const actionAssignScrambles = () =>
    handleWcifChange(autoAssignScrambles(wcif, uploadedScrambles));

  const actionClearScrambles = () =>
    handleWcifChange(clearScrambles(wcif));

  return (
    <Fragment>
      <CompetitionDetailsPanel downloadWcifAction={actionDownloadWcif}
        downloadResultsJsonAction={actionDownloadResultsJson}
        classes={classes}
        exportAvailable={exportAvailable}
      />
      <MatchingScramblesPanel assignAction={actionAssignScrambles}
        clearAction={actionClearScrambles}
        classes={classes}
      />
      <UploadedScramblesPanel uploadAction={uploadAction}
        uploadedScrambles={uploadedScrambles}
        classes={classes}
      />
    </Fragment>
  );
}

export default CompetitionInfo;
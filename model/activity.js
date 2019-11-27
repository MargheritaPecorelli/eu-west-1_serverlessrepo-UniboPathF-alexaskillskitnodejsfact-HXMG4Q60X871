class Activity {

    constructor(actName, actLocationName, actSpeaker) {
        this.myName = actName;
        this.myLocation = actLocationName;
        this.mySpeaker = actSpeaker;
    }
  
    name() {
        return this.myName;
    }
    
    location() {
        return this.myLocation;
    }

    speaker() {
        return this.mySpeaker;
    }
}

module.exports = Activity;


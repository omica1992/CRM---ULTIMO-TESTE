import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Schedule from "./Schedule";
import User from "./User";

@Table({
  tableName: "ScheduleUsers"
})
class ScheduleUser extends Model<ScheduleUser> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Schedule)
  @Column
  scheduleId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Schedule)
  schedule: Schedule;

  @BelongsTo(() => User)
  user: User;
}

export default ScheduleUser;
